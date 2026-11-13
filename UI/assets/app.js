/* Sunset Bay console: shared tab, filter and navigation behaviour. */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const iconOf = (el) => text($('.material-symbols-outlined', el));

  const PAGES = {
    dashboard: 'dashboard',
    conversations: 'conversations',
    guests: 'guests',
    'knowledge-base': 'knowledge_base',
    'triggers-and-alerts': 'triggers_alerts',
    profile: 'profile',
  };

  /* Makes a row of buttons/links behave as tabs: exactly one active at a time. */
  function tabGroup(items, activeIndex, onSelect) {
    if (items.length < 2) return;
    const activeCls = items[activeIndex].className;
    const idleCls = items.find((_, i) => i !== activeIndex).className;
    items.forEach((item, i) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        items.forEach((x) => (x.className = idleCls));
        item.className = activeCls;
        onSelect(i, item);
      });
    });
  }

  /* Cross-document view transitions fade between pages instead of a hard flash. */
  function enablePageTransitions() {
    const style = document.createElement('style');
    style.textContent = '@view-transition { navigation: auto; }';
    document.head.appendChild(style);
  }

  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    conversations: 'Conversations',
    tickets: 'Tickets',
    guests: 'Guests',
    'knowledge-base': 'Knowledge Base',
    analytics: 'Analytics',
    'triggers-and-alerts': 'Triggers & Alerts',
    settings: 'Settings',
    message: 'Message',
  };

  function getActivePageKey() {
    const raw = (window.location.pathname || window.location.href || '').toLowerCase().replace(/\\/g, '/');
    for (const [key, folder] of Object.entries(PAGES)) {
      if (raw.includes('/' + folder.toLowerCase() + '/') || raw.includes('/' + folder.toLowerCase() + '.html')) {
        return key;
      }
    }
    for (const key of Object.keys(PAGES)) {
      if (raw.includes('/' + key.toLowerCase() + '/') || raw.includes('/' + key.toLowerCase() + '.html')) {
        return key;
      }
    }
    return 'dashboard';
  }

  function wireSidebar() {
    enablePageTransitions();
    const settingsLink = $('aside a[data-path="settings"]');
    if (settingsLink) settingsLink.remove();

    $$('img[alt="Profile"]').forEach((image) => {
      const existingLink = image.closest('a');
      if (existingLink) {
        existingLink.href = '../profile/code.html';
        return;
      }
      const link = document.createElement('a');
      link.href = '../profile/code.html';
      link.className = 'inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary';
      link.setAttribute('aria-label', 'Open profile');
      image.classList.add('cursor-pointer');
      image.replaceWith(link);
      link.append(image);
    });

    const currentFolder = location.pathname.split('/').slice(-2, -1)[0];
    const currentPage = Object.keys(PAGES).find((page) => PAGES[page] === currentFolder);
    const savedUnreadCount = localStorage.getItem('unread-conversation-count');
    if (savedUnreadCount !== null) {
      const unreadCount = Math.max(0, Number(savedUnreadCount) || 0);
      const badge = $('aside a[data-path="conversations"] span.rounded-full');
      if (badge) {
        badge.textContent = String(unreadCount);
        badge.hidden = unreadCount === 0;
      }
      const notification = $$('header .material-symbols-outlined').find((icon) => icon.textContent.trim() === 'notifications');
      const dot = notification && notification.parentElement.querySelector('span.absolute');
      if (dot) dot.hidden = unreadCount === 0;
    }
    const activeClasses = ['bg-secondary', 'text-on-secondary', 'font-bold'];
    const inactiveClasses = [
      'text-primary-fixed-dim',
      'hover:bg-surface-container-high',
      'hover:text-on-surface',
    ];
    const legacyClasses = ['bg-[#ac3327]', 'text-white', 'font-semibold', 'text-slate-200', 'hover:bg-white/10'];

    $$('aside a[data-path]').forEach((a) => {
      const folder = PAGES[a.dataset.path];
      if (!folder) return;
      a.href = '../' + folder + '/code.html';
      a.classList.remove(...activeClasses, ...inactiveClasses, ...legacyClasses);
      a.classList.add('rounded-xl');
      if (a.dataset.path === 'dashboard') a.classList.remove('justify-between');
      if (a.dataset.path === currentPage) {
        a.classList.add(...activeClasses);
        a.setAttribute('aria-current', 'page');
      } else {
        a.classList.add(...inactiveClasses);
        a.removeAttribute('aria-current');
      }
      const pre = document.createElement('link');
      pre.rel = 'prefetch';
      pre.href = a.href;
      document.head.appendChild(pre);
    });

    if (currentPage === 'profile') {
      const heading = $('main h1');
      if (heading) heading.textContent = 'Profile';
      document.title = 'Profile';
    }
  }

  /* Dashboard: 7D / 14D / 30D period switch + Needs attention row edit & takeover & delete */
  function initDashboard() {
    const periods = $$('button').filter((b) => ['7D', '14D', '30D'].includes(text(b)));
    if (periods.length) {
      tabGroup(periods, periods.findIndex((b) => text(b) === '14D'), () => { });
    }

    let activeEditRow = null;

    function updateAlertBanner() {
      const bannerText = $('.text-body-md.text-on-surface.font-medium');
      const table = $('table');
      if (bannerText && table) {
        const count = $$('tbody tr', table).length;
        bannerText.textContent = `${count} guest${count === 1 ? '' : 's'} have been waiting for staff for more than 5 minutes`;
      }
    }

    const table = $('table');
    if (table) {
      table.onclick = (e) => {
        const takeoverBtn = e.target.closest('.takeover-btn');
        if (takeoverBtn) {
          e.preventDefault();
          e.stopPropagation();
          if (takeoverBtn.dataset.taken === 'true') {
            window.location.href = '../conversations/code.html';
            return;
          }
          takeoverBtn.dataset.taken = 'true';
          takeoverBtn.className = 'border border-emerald-500 bg-emerald-500/10 text-emerald-600 px-2.5 py-1 rounded-lg text-label-md font-semibold transition-all flex items-center gap-1';
          takeoverBtn.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> In Progress';
          const tr = takeoverBtn.closest('tr');
          if (tr && tr.children[3]) {
            tr.children[3].innerHTML = '<span class="bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-label-sm font-bold">Assigned</span>';
          }
          return;
        }

        const editBtn = e.target.closest('.edit-issue-btn');
        if (editBtn) {
          e.preventDefault();
          e.stopPropagation();
          const tr = editBtn.closest('tr');
          if (tr) {
            activeEditRow = tr;
            openDashboardEditModal(tr);
          }
          return;
        }

        const delBtn = e.target.closest('.delete-issue-btn');
        if (delBtn) {
          e.preventDefault();
          e.stopPropagation();
          const tr = delBtn.closest('tr');
          if (tr) {
            const guestName = text(tr.children[0].querySelector('span')) || 'this guest';
            if (confirm(`Dismiss/delete attention item for ${guestName}?`)) {
              tr.remove();
              updateAlertBanner();
            }
          }
          return;
        }
      };
    }

    function openDashboardEditModal(tr) {
      const modal = $('#editIssueModal');
      if (!modal) return;
      const guestName = text(tr.children[0].querySelector('span'));
      const issue = text(tr.children[1]);
      const lang = text(tr.children[2]);
      const priority = text(tr.children[3]);
      const waiting = text(tr.children[4]);

      $('#editGuestName').value = guestName;
      $('#editGuestIssue').value = issue;
      $('#editGuestLang').value = lang || 'KO';
      $('#editGuestPriority').value = priority || 'High';
      $('#editGuestWaiting').value = waiting;

      modal.classList.remove('hidden');
    }

    window.closeEditIssueModal = function () {
      const modal = $('#editIssueModal');
      if (modal) modal.classList.add('hidden');
      activeEditRow = null;
    };

    window.saveEditIssue = function () {
      if (!activeEditRow) return;
      const guestName = $('#editGuestName').value.trim();
      const issue = $('#editGuestIssue').value.trim();
      const lang = $('#editGuestLang').value;
      const priority = $('#editGuestPriority').value;
      const waiting = $('#editGuestWaiting').value.trim();

      if (guestName) {
        const nameSpan = activeEditRow.children[0].querySelector('span');
        if (nameSpan) nameSpan.textContent = guestName;
      }
      if (issue) {
        activeEditRow.children[1].textContent = issue;
      }
      if (lang) {
        activeEditRow.children[2].innerHTML = `<span class="bg-surface-container text-on-surface px-2 py-0.5 rounded text-label-sm font-bold">${lang}</span>`;
      }
      if (priority) {
        const pColor = priority === 'High' ? 'bg-[#EE6352]/10 text-[#EE6352]' : priority === 'Medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-surface-container text-on-surface-variant';
        activeEditRow.children[3].innerHTML = `<span class="${pColor} px-2 py-0.5 rounded-full text-label-sm font-bold">${priority}</span>`;
      }
      if (waiting) {
        activeEditRow.children[4].textContent = waiting;
      }

      activeEditRow.classList.add('bg-emerald-500/10');
      setTimeout(() => activeEditRow.classList.remove('bg-emerald-500/10'), 800);

      window.closeEditIssueModal();
    };
  }

  /* Per-conversation data for full panel swap */
  const CONV_DATA = {
    'Rohan Naik': {
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCe-i-wNLxyaUQRcBVVg3m9ASkNpR4s_6ZOc3DuXGByxs2nQCkBm31RGCGwS3sy_tDNaYuXONpJDMUtdPwvPOa2RGS7w8O78cE_POXhsAGYecCvGFslnrRhaMTSokA_1LgDyM_MizJcGvdB-wvfHuFo3q3S_AwNCcAJC86njvxPt0D-6zqGTIaz9MZC4QHjGBGatOH8GlussQOsty7IgBS6fqd-Q5NesNV04Iz0mA',
      phone: '+91 98230 44512',
      location: 'Calangute, Goa',
      channel: 'WhatsApp',
      lang: 'Konkani + English',
      status: 'Needs Staff',
      statusColor: '#EE6352',
      rightAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAGcXbZ_ojUILhVD6RdXatc4V4bbHNObtGiB9EGC6LVmSdjAMGzjUKPUZ-JOPwr-qWYzjtxTAWQo_LNBxIzbwMqy-RgNPdwWbi1luMKwTIRvHq157ckQ-AJK8ECMKoV3UNMBdxCbQC7rYfrqKFwwVytR782H3vGQsyBFnVGtYwSwwZqonjCEkqfRhBpX0Hzhpnoh8szQmZpIQsNz4vo2KUmzNabRXUbPdEu0ekxEA',
      tags: ['Priority: High', '3 Stays', 'Sea-facing pref'],
      tagColors: ['#EE6352', 'primary', '#00ABE7'],
      preferredLang: 'Konkani / English',
      lifetimeSpend: '₹45,200',
      aiAlert: 'AI flagged this chat: angry sentiment detected',
      messages: `
        <div class="flex items-end gap-2 max-w-[70%]">
          <img class="w-7 h-7 rounded-full object-cover mb-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLXCCT0TaazTR16bCIhjYw5t1ARmGE0F8yP3tzqwkJeHbsWlrXNW4aGGgbGHkPTne254yN1qkV0s8RyA8Sm-DmLlCR5YC0o3oZWpWwwVQ5YoLa8K2Xtk3039KDFVVgBnqozgYfk3nfjSK8hTrYCVKqSYIL6zTahGOW_Kt5JGNsUA8eHCNbxbtIyJ20e3wxgzWjyEitC5zIMLBqcYBNSvUzhfVMCNdRaAbTB_00Hw"/>
          <div class="bg-surface-container-lowest p-3.5 rounded-2xl rounded-bl-sm shadow-sm">
            <p class="text-body-md text-on-surface">Hello, mala 2 rooms pahije asat 24 Dec la. Rate kitle astat?</p>
            <span class="text-[10px] text-outline mt-1 block text-right">10:38 AM</span>
          </div>
        </div>
        <div class="flex items-end gap-2 max-w-[70%] ml-auto flex-row-reverse">
          <div class="w-7 h-7 rounded-full bg-[#00ABE7]/20 text-[#00ABE7] flex items-center justify-center font-bold text-xs mb-1">AI</div>
          <div class="bg-[#00ABE7]/10 p-3.5 rounded-2xl rounded-br-sm shadow-sm">
            <div class="flex items-center gap-1.5 mb-1 text-[#00ABE7] text-[10px] font-bold"><span class="material-symbols-outlined text-xs">smart_toy</span>AI Response (Confidence: 94%)</div>
            <p class="text-body-md text-on-surface">Hello Mr. Rohan! Yes, we have sea-facing rooms available for 24 Dec. Standard rates are ₹8,500/night + taxes. Shall I hold them for you?</p>
            <span class="text-[10px] text-outline mt-1 block text-right">10:39 AM</span>
          </div>
        </div>
        <div class="flex items-end gap-2 max-w-[70%]">
          <img class="w-7 h-7 rounded-full object-cover mb-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBf1EFQHppp50k9TeVMgm4o5Jta2jy2h2soFAnqWLDyUN39KfCGj5XcV_ohEbB2SWb2kkLZKs2d8MMFIiXz5MidYE4N6qqPv7AOb2SG9MlSICriEv2RiqSmmpigKYei-nc0OW3CyPZJRu4YpjjnsylADZXDleTA1ccgQAdisCO--z3mBYGulp66biujGfIKc90PDUjGK200plMo-DDjMq54UudAWZ2Z2Nc5VkKzoA"/>
          <div class="bg-surface-container-lowest p-3.5 rounded-2xl rounded-bl-sm shadow-sm border border-[#EE6352]/30">
            <p class="text-body-md text-on-surface">Kay zata he? Last week mala 7k sangtlo tumcho bot! Ata kay 8.5k? Hya zavn fante fasavnuk zata! I want manager call now!</p>
            <span class="text-[10px] text-[#EE6352] mt-1 block text-right font-medium">10:41 AM - Angry tone</span>
          </div>
        </div>`,
      composerPlaceholder: 'Type your reply to Rohan in English or Konkani...',
      suggestedReply: '"Apurlai Rohan, sorry for the confusion! Let me apply our loyal guest 15% discount for you right now. 2 rooms @ ₹7,000 confirm korunk zata ka?"',
      suggestedReplyLabel: 'AI suggested reply (Code-mixed Konkani/English)',
      suggestedReplyConf: '91%',
      aiSummary: {
        happened: 'Guest inquired about 2 rooms for Dec 24. AI quoted standard peak rate of ₹8,500. Guest got upset referencing a lower bot quote from last week.',
        wants: 'Wants rooms at previously implied ₹7,000 rate and spoke to manager about inconsistency.',
        tried: 'Offered standard rates and check-in details. Escalated to staff upon detecting negative sentiment keywords.',
        sentiment: 'Angry (75%)',
        sentimentW: 'w-3/4',
        sentimentColor: '#EE6352',
      },
      tickets: [{ id: '#TK-8942', label: 'Escalated', desc: 'Pricing discrepancy complaint regarding December festive rates.' }],
      memories: [
        { icon: 'hotel', text: 'Prefers Room 304 or similar pool view', date: 'Added 14 Oct 2023' },
        { icon: 'restaurant', text: 'Allergic to shell fish, prefers continental breakfast', date: 'Added 02 Jan 2023' },
        { icon: 'favorite', text: 'Likes early check-in when available', date: 'Added 18 Dec 2022' },
      ],
    },
    'Vikram Dessai': {
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgQwGJgua4jnFpy9T6rZmw95N5FVQa3IkyJZr7IuoTYL6nFS_O2jSUs3Qq_L2I9E7976ueyqGcmTAyIVt5RcBtJVQUqtj-_DdHizJNGyYX5_otwl9rk27f1V4ct_EKNoeOzO8tBy-wC_NfMVHVQRqG26u4mKrvFr-gY9sDFzRgWHrHFb70MrkZHhqQOnovRkdp900v-FlaFv1x8WcWZA15gE4iU_ZTSPFiJD9bgg',
      phone: '+91 94220 55781',
      location: 'Panaji, Goa',
      channel: 'WhatsApp',
      lang: 'Konkani',
      status: 'Needs Staff',
      statusColor: '#EE6352',
      rightAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgQwGJgua4jnFpy9T6rZmw95N5FVQa3IkyJZr7IuoTYL6nFS_O2jSUs3Qq_L2I9E7976ueyqGcmTAyIVt5RcBtJVQUqtj-_DdHizJNGyYX5_otwl9rk27f1V4ct_EKNoeOzO8tBy-wC_NfMVHVQRqG26u4mKrvFr-gY9sDFzRgWHrHFb70MrkZHhqQOnovRkdp900v-FlaFv1x8WcWZA15gE4iU_ZTSPFiJD9bgg',
      tags: ['Priority: Medium', '1 Stay', 'Late Checkout pref'],
      tagColors: ['#EE6352', 'primary', '#00ABE7'],
      preferredLang: 'Konkani',
      lifetimeSpend: '₹12,500',
      aiAlert: 'AI flagged this chat: checkout extension requested',
      messages: `
        <div class="flex items-end gap-2 max-w-[70%]">
          <img class="w-7 h-7 rounded-full object-cover mb-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgQwGJgua4jnFpy9T6rZmw95N5FVQa3IkyJZr7IuoTYL6nFS_O2jSUs3Qq_L2I9E7976ueyqGcmTAyIVt5RcBtJVQUqtj-_DdHizJNGyYX5_otwl9rk27f1V4ct_EKNoeOzO8tBy-wC_NfMVHVQRqG26u4mKrvFr-gY9sDFzRgWHrHFb70MrkZHhqQOnovRkdp900v-FlaFv1x8WcWZA15gE4iU_ZTSPFiJD9bgg"/>
          <div class="bg-surface-container-lowest p-3.5 rounded-2xl rounded-bl-sm shadow-sm">
            <p class="text-body-md text-on-surface">Checkout time extend korunk zata ka? Maka 2 PM paryant rahunk zata?</p>
            <span class="text-[10px] text-outline mt-1 block text-right">9:15 AM</span>
          </div>
        </div>
        <div class="flex items-end gap-2 max-w-[70%] ml-auto flex-row-reverse">
          <div class="w-7 h-7 rounded-full bg-[#00ABE7]/20 text-[#00ABE7] flex items-center justify-center font-bold text-xs mb-1">AI</div>
          <div class="bg-[#00ABE7]/10 p-3.5 rounded-2xl rounded-br-sm shadow-sm">
            <div class="flex items-center gap-1.5 mb-1 text-[#00ABE7] text-[10px] font-bold"><span class="material-symbols-outlined text-xs">smart_toy</span>AI Response (Confidence: 78%)</div>
            <p class="text-body-md text-on-surface">Namaskaar Vikram ji! Late checkout 2 PM paryant available asa, pan extra ₹500 charge asata. Confirm kortam ka?</p>
            <span class="text-[10px] text-outline mt-1 block text-right">9:16 AM</span>
          </div>
        </div>
        <div class="flex items-end gap-2 max-w-[70%]">
          <img class="w-7 h-7 rounded-full object-cover mb-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDgQwGJgua4jnFpy9T6rZmw95N5FVQa3IkyJZr7IuoTYL6nFS_O2jSUs3Qq_L2I9E7976ueyqGcmTAyIVt5RcBtJVQUqtj-_DdHizJNGyYX5_otwl9rk27f1V4ct_EKNoeOzO8tBy-wC_NfMVHVQRqG26u4mKrvFr-gY9sDFzRgWHrHFb70MrkZHhqQOnovRkdp900v-FlaFv1x8WcWZA15gE4iU_ZTSPFiJD9bgg"/>
          <div class="bg-surface-container-lowest p-3.5 rounded-2xl rounded-bl-sm shadow-sm">
            <p class="text-body-md text-on-surface">₹500 zaasta zata. Manager konn asa? Taka sangta ka free korunk?</p>
            <span class="text-[10px] text-outline mt-1 block text-right">9:18 AM</span>
          </div>
        </div>`,
      composerPlaceholder: 'Type your reply to Vikram in Konkani...',
      suggestedReply: '"Vikram bab, ami tumkam complimentary late checkout 2 PM paryant dita. Kahi problem nasot!"',
      suggestedReplyLabel: 'AI suggested reply (Konkani)',
      suggestedReplyConf: '84%',
      aiSummary: {
        happened: 'Guest requested a late checkout until 2 PM. AI quoted ₹500 extra charge. Guest pushed back and asked to speak to a manager for a waiver.',
        wants: 'Complimentary late checkout until 2 PM.',
        tried: 'Offered standard late checkout policy with ₹500 fee. Escalated to staff after guest asked for manager.',
        sentiment: 'Neutral (40%)',
        sentimentW: 'w-2/5',
        sentimentColor: '#F59E0B',
      },
      tickets: [{ id: '#TK-8951', label: 'Open', desc: 'Late checkout waiver request — Oct 24.' }],
      memories: [
        { icon: 'hotel', text: 'First-time guest, booked Deluxe Sea View', date: 'Added 24 Oct 2024' },
        { icon: 'favorite', text: 'Prefers quiet rooms away from pool area', date: 'Added 24 Oct 2024' },
      ],
    },
    'Jessica Taylor': {
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvSsjzuBiGMMYktkkDg2dRFJ_MX_k62NLwgWIeO935NrXHG3vf1upvjKLbu2isYJ7WjLYUYnDvMjfD6Fzga1jQnTL3MoYaMuJ2Kr9quWOWgOnfjAK30QEhoBDsRIcsEXCOvLukOtHTHyiaDQ5BHa2_VLPZzqkC5slc5y-6IdNAsBF6h7z3xdACmkFKit9GtYKqLdgQWBI1DO-fOKn-sJxkqmfmZrWFPgTqGHvodA',
      phone: '+44 7700 900142',
      location: 'London, UK',
      channel: 'WhatsApp',
      lang: 'English',
      status: 'AI Handling',
      statusColor: '#00ABE7',
      rightAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDvSsjzuBiGMMYktkkDg2dRFJ_MX_k62NLwgWIeO935NrXHG3vf1upvjKLbu2isYJ7WjLYUYnDvMjfD6Fzga1jQnTL3MoYaMuJ2Kr9quWOWgOnfjAK30QEhoBDsRIcsEXCOvLukOtHTHyiaDQ5BHa2_VLPZzqkC5slc5y-6IdNAsBF6h7z3xdACmkFKit9GtYKqLdgQWBI1DO-fOKn-sJxkqmfmZrWFPgTqGHvodA',
      tags: ['Priority: Normal', '2 Stays', 'Beach-facing pref'],
      tagColors: ['#75777e', 'primary', '#00ABE7'],
      preferredLang: 'English',
      lifetimeSpend: '₹28,000',
      aiAlert: null,
      messages: `
        <div class="flex items-end gap-2 max-w-[70%]">
          <img class="w-7 h-7 rounded-full object-cover mb-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvSsjzuBiGMMYktkkDg2dRFJ_MX_k62NLwgWIeO935NrXHG3vf1upvjKLbu2isYJ7WjLYUYnDvMjfD6Fzga1jQnTL3MoYaMuJ2Kr9quWOWgOnfjAK30QEhoBDsRIcsEXCOvLukOtHTHyiaDQ5BHa2_VLPZzqkC5slc5y-6IdNAsBF6h7z3xdACmkFKit9GtYKqLdgQWBI1DO-fOKn-sJxkqmfmZrWFPgTqGHvodA"/>
          <div class="bg-surface-container-lowest p-3.5 rounded-2xl rounded-bl-sm shadow-sm">
            <p class="text-body-md text-on-surface">Can we arrange an airport pickup for tomorrow morning? Flight lands at 6 AM.</p>
            <span class="text-[10px] text-outline mt-1 block text-right">Yesterday, 8:10 PM</span>
          </div>
        </div>
        <div class="flex items-end gap-2 max-w-[70%] ml-auto flex-row-reverse">
          <div class="w-7 h-7 rounded-full bg-[#00ABE7]/20 text-[#00ABE7] flex items-center justify-center font-bold text-xs mb-1">AI</div>
          <div class="bg-[#00ABE7]/10 p-3.5 rounded-2xl rounded-br-sm shadow-sm">
            <div class="flex items-center gap-1.5 mb-1 text-[#00ABE7] text-[10px] font-bold"><span class="material-symbols-outlined text-xs">smart_toy</span>AI Response (Confidence: 97%)</div>
            <p class="text-body-md text-on-surface">Hi Jessica! Absolutely, we offer airport transfers for ₹1,800 each way. I've noted your 6 AM landing. Shall I confirm the pickup?</p>
            <span class="text-[10px] text-outline mt-1 block text-right">Yesterday, 8:11 PM</span>
          </div>
        </div>`,
      composerPlaceholder: 'Type your reply to Jessica in English...',
      suggestedReply: '"Hi Jessica! Your pickup is confirmed for 5:45 AM from Dabolim. Driver will WhatsApp you 30 mins before. Safe travels!"',
      suggestedReplyLabel: 'AI suggested reply (English)',
      suggestedReplyConf: '97%',
      aiSummary: {
        happened: 'Guest requested an airport pickup for a 6 AM arrival. AI confirmed the ₹1,800 transfer rate.',
        wants: 'Confirmed airport pickup at 6 AM arrival.',
        tried: 'Quoted transfer rates and asked for confirmation.',
        sentiment: 'Positive (20%)',
        sentimentW: 'w-1/5',
        sentimentColor: '#10B981',
      },
      tickets: [],
      memories: [
        { icon: 'flight', text: 'Prefers early morning airport pickups', date: 'Added 05 Jan 2024' },
        { icon: 'hotel', text: 'Returning guest — stayed Jan 2024', date: 'Added 05 Jan 2024' },
      ],
    },
    'Chloe Bennett': {
      avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6fWBynB2AkRrayYdQ00EYLvZwRT6Hl_ZWfNNYyGXSS4MnFBfGsT9mkL8vxdPmr3HF9g-FvAJmA_uNr9ouVSlkV7cbE9Cuy_4nm8PaQu5JM999jmFD3ng3k7il2MG5qID4oxgRQJMuYYmzg8ckosqmgrtg_zHH-TiMul9TpGSt_jH-LLCyRpNrsmnj8Xru1uaDcgzjjAqWJ7AarWEqNhdNZk0i6hDs1g8mJyisrA',
      phone: '+33 6 12 34 56 78',
      location: 'Paris, France',
      channel: 'WhatsApp',
      lang: 'English / French',
      status: 'Resolved',
      statusColor: '#10B981',
      rightAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6fWBynB2AkRrayYdQ00EYLvZwRT6Hl_ZWfNNYyGXSS4MnFBfGsT9mkL8vxdPmr3HF9g-FvAJmA_uNr9ouVSlkV7cbE9Cuy_4nm8PaQu5JM999jmFD3ng3k7il2MG5qID4oxgRQJMuYYmzg8ckosqmgrtg_zHH-TiMul9TpGSt_jH-LLCyRpNrsmnj8Xru1uaDcgzjjAqWJ7AarWEqNhdNZk0i6hDs1g8mJyisrA',
      tags: ['Priority: Normal', '1 Stay', 'First-time guest'],
      tagColors: ['#75777e', 'primary', '#00ABE7'],
      preferredLang: 'English',
      lifetimeSpend: '₹24,000',
      aiAlert: null,
      messages: `
        <div class="flex items-end gap-2 max-w-[70%]">
          <img class="w-7 h-7 rounded-full object-cover mb-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6fWBynB2AkRrayYdQ00EYLvZwRT6Hl_ZWfNNYyGXSS4MnFBfGsT9mkL8vxdPmr3HF9g-FvAJmA_uNr9ouVSlkV7cbE9Cuy_4nm8PaQu5JM999jmFD3ng3k7il2MG5qID4oxgRQJMuYYmzg8ckosqmgrtg_zHH-TiMul9TpGSt_jH-LLCyRpNrsmnj8Xru1uaDcgzjjAqWJ7AarWEqNhdNZk0i6hDs1g8mJyisrA"/>
          <div class="bg-surface-container-lowest p-3.5 rounded-2xl rounded-bl-sm shadow-sm">
            <p class="text-body-md text-on-surface">Thanks for the wonderful stay! Highly recommended. The staff was absolutely amazing!</p>
            <span class="text-[10px] text-outline mt-1 block text-right">Oct 22, 11:05 AM</span>
          </div>
        </div>
        <div class="flex items-end gap-2 max-w-[70%] ml-auto flex-row-reverse">
          <div class="w-7 h-7 rounded-full bg-[#00ABE7]/20 text-[#00ABE7] flex items-center justify-center font-bold text-xs mb-1">AI</div>
          <div class="bg-[#00ABE7]/10 p-3.5 rounded-2xl rounded-br-sm shadow-sm">
            <div class="flex items-center gap-1.5 mb-1 text-[#00ABE7] text-[10px] font-bold"><span class="material-symbols-outlined text-xs">smart_toy</span>AI Response (Confidence: 99%)</div>
            <p class="text-body-md text-on-surface">Thank you so much, Chloe! We're thrilled you had a wonderful stay. Hope to welcome you back soon at Sunset Bay! 🌅</p>
            <span class="text-[10px] text-outline mt-1 block text-right">Oct 22, 11:06 AM</span>
          </div>
        </div>`,
      composerPlaceholder: 'Type your reply to Chloe in English...',
      suggestedReply: '"Dear Chloe, thank you for the lovely review! We\'ve shared your kind words with the team. See you next time! 🌊"',
      suggestedReplyLabel: 'AI suggested reply (English)',
      suggestedReplyConf: '99%',
      aiSummary: {
        happened: 'Guest sent a positive review after checkout praising the staff and overall experience.',
        wants: 'No action needed — conversation resolved.',
        tried: 'AI replied with a thank-you and invitation to return.',
        sentiment: 'Very Positive (5%)',
        sentimentW: 'w-1/12',
        sentimentColor: '#10B981',
      },
      tickets: [],
      memories: [
        { icon: 'favorite', text: 'Loves beach-view rooms and spa services', date: 'Added 22 Oct 2024' },
      ],
    },
  };

  function renderConversation(data) {
    if (!data) return;

    /* ---- CENTER: header ---- */
    const centerCol = $('.flex-1.flex.flex-col.h-full.bg-surface');
    if (!centerCol) return;
    const headerImg = $('img.w-10.h-10.rounded-full', centerCol);
    if (headerImg) headerImg.src = data.avatar;
    const headerName = $('.text-headline-sm.font-semibold', centerCol);
    if (headerName) headerName.textContent = data.name || '';
    const headerPhone = $('.text-body-sm.text-outline', centerCol);
    if (headerPhone) headerPhone.textContent = data.phone;
    const tags = $$('.bg-surface-container.px-2.py-0\\.5, .bg-\\[\\#00ABE7\\]\\/10', centerCol);
    if (tags[0]) tags[0].textContent = data.channel;
    if (tags[1]) tags[1].textContent = data.lang;

    /* ---- CENTER: messages ---- */
    const msgScroll = $('.flex-1.overflow-y-auto.p-space-lg.space-y-space-md', centerCol);
    if (msgScroll) {
      msgScroll.innerHTML = data.aiAlert
        ? `<div class="flex justify-center my-2">
             <div class="bg-[#EE6352]/10 text-[#EE6352] px-4 py-1.5 rounded-full text-label-md font-medium flex items-center gap-1.5">
               <span class="material-symbols-outlined text-sm">warning</span>${data.aiAlert}
             </div>
           </div>${data.messages}`
        : data.messages;
    }

    /* ---- CENTER: suggested reply ---- */
    const composerArea = $('.p-space-lg.bg-surface-container-lowest.border-t', centerCol);
    if (composerArea) {
      const suggCard = composerArea.firstElementChild;
      if (suggCard) {
        const italicEl = $('p.italic', suggCard) || $('p', suggCard);
        if (italicEl) italicEl.textContent = data.suggestedReply;
        const confEl = $('[class*="text-\\[10px\\]"]', suggCard);
        if (confEl) confEl.textContent = 'Confidence: ' + data.suggestedReplyConf;
      }
      const textarea = $('textarea', composerArea);
      if (textarea) textarea.placeholder = data.composerPlaceholder;
    }

    /* ---- RIGHT: guest card ---- */
    const rightCol = $('.w-\\[340px\\]');
    if (!rightCol) return;
    const rightImg = $('img.w-16', rightCol);
    if (rightImg) rightImg.src = data.rightAvatar;
    const rightH3 = $('h3', rightCol);
    if (rightH3) rightH3.textContent = data.name || '';
    const rightSub = $('p.text-body-sm.text-outline', rightCol);
    if (rightSub) rightSub.textContent = data.phone + ' • ' + data.location;

    // Tags
    const tagsWrap = $('.flex.flex-wrap.gap-1\\.5.justify-center', rightCol);
    if (tagsWrap) {
      tagsWrap.innerHTML = data.tags.map((t, i) => {
        const c = data.tagColors[i] === 'primary'
          ? 'bg-primary/10 text-primary'
          : `bg-[${data.tagColors[i]}]/20 text-[${data.tagColors[i]}]`;
        const bold = i === 0 ? 'font-bold' : 'font-medium';
        return `<span class="${c} text-label-sm px-2 py-0.5 rounded-full ${bold}">${t}</span>`;
      }).join('');
    }

    // Preferred lang & lifetime spend
    const gridCells = $$('.grid.grid-cols-2 > div', rightCol);
    if (gridCells[0]) gridCells[0].lastElementChild.textContent = data.preferredLang;
    if (gridCells[1]) gridCells[1].lastElementChild.textContent = data.lifetimeSpend;

    /* ---- RIGHT: AI Summary ---- */
    const summaryDivs = $$('.space-y-3 > div', rightCol);
    if (summaryDivs[0]) summaryDivs[0].lastElementChild.textContent = data.aiSummary.happened;
    if (summaryDivs[1]) summaryDivs[1].lastElementChild.textContent = data.aiSummary.wants;
    if (summaryDivs[2]) summaryDivs[2].lastElementChild.textContent = data.aiSummary.tried;
    // Sentiment bar
    const sentBar = $('.w-16.h-2 > div', rightCol);
    if (sentBar) {
      sentBar.className = sentBar.className.replace(/w-\S+/, data.aiSummary.sentimentW);
      sentBar.style.background = data.aiSummary.sentimentColor;
    }
    const sentLabel = $('[class*="font-bold"][class*="text-\\[10px\\]"]', rightCol);
    if (sentLabel) {
      sentLabel.textContent = data.aiSummary.sentiment;
      sentLabel.style.color = data.aiSummary.sentimentColor;
    }

    /* ---- RIGHT: Open Tickets ---- */
    const ticketsWrap = rightCol.querySelectorAll('.bg-surface-container.p-4.rounded-xl');
    if (ticketsWrap[0]) {
      const ticketInner = ticketsWrap[0].lastElementChild;
      const countEl = ticketsWrap[0].querySelector('.text-label-sm');
      if (countEl) {
        countEl.textContent = data.tickets.length + ' Active';
        countEl.style.color = data.tickets.length ? '#EE6352' : '#75777e';
      }
      if (ticketInner) {
        ticketInner.innerHTML = data.tickets.length
          ? data.tickets.map((t) => `
              <div class="bg-surface-container-lowest p-3 rounded-lg border-l-4 border-[#EE6352]">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-body-sm font-bold text-on-surface">${t.id}</span>
                  <span class="text-[10px] bg-[#EE6352]/20 text-[#EE6352] px-1.5 py-0.5 rounded font-bold">${t.label}</span>
                </div>
                <p class="text-body-sm text-on-surface-variant text-xs">${t.desc}</p>
              </div>`).join('')
          : '<p class="text-body-sm text-on-surface-variant text-xs">No open tickets.</p>';
      }
    }

    /* ---- RIGHT: Guest Memory ---- */
    if (ticketsWrap[1]) {
      const memInner = ticketsWrap[1].querySelector('.space-y-3');
      if (memInner) {
        memInner.innerHTML = data.memories.map((m, i) => `
          <div class="flex items-start gap-2.5${i < data.memories.length - 1 ? ' pb-2.5 border-b border-outline-variant/20' : ''}">
            <span class="material-symbols-outlined text-sm text-[#00ABE7] mt-0.5">${m.icon}</span>
            <div>
              <p class="text-on-surface font-medium text-xs">${m.text}</p>
              <span class="text-[10px] text-outline">${m.date}</span>
            </div>
          </div>`).join('');
      }
    }
  }

  /* Conversations: status filter tabs + search + row selection */
  function initConversations() {
    if (document.body.dataset.liveConversations) return; // rendered from Supabase by conversations.js
    const search = $('input[placeholder^="Search conversations"]');
    if (!search) return;
    const list = $('.space-y-2.overflow-y-auto');
    if (!list) return;
    const rows = Array.from(list.children);
    const tabs = $$('button').filter((b) => /^(All|AI handling|Needs staff|Resolved)\b/.test(text(b)));

    let filter = 'All';
    let query = '';
    const statusOf = (row) => (text(row).match(/Needs Staff|AI Handling|Resolved/i) || [''])[0].toLowerCase();
    const wanted = { All: null, 'AI handling': 'ai handling', 'Needs staff': 'needs staff', Resolved: 'resolved' };

    function applyFilters() {
      rows.forEach((row) => {
        const okStatus = !wanted[filter] || statusOf(row) === wanted[filter];
        const okQuery = !query || text(row).toLowerCase().includes(query);
        row.style.display = okStatus && okQuery ? '' : 'none';
      });
    }

    tabGroup(tabs, 0, (_, btn) => {
      filter = text(btn).replace(/\d+$/, '').trim();
      applyFilters();
    });
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      applyFilters();
    });

    rows.forEach((row) =>
      row.addEventListener('click', () => {
        rows.forEach((r) => {
          r.classList.remove('bg-surface-container');
          r.style.borderLeft = '';
        });
        row.classList.add('bg-surface-container');
        row.style.borderLeft = '4px solid #EE6352';
        const name = text($('.text-headline-sm', row));
        const data = CONV_DATA[name];
        if (data) renderConversation({ ...data, name });
      })
    );
  }

  /* Tickets: Kanban / List view toggle */
  function initTickets() {
    const cards = $$('[onclick="openSlideOver()"]');
    const board = cards.length ? cards[0].parentElement.parentElement.parentElement : null;
    if (!board) return;

    const STAFF_AVATARS = {
      'Ramesh Kumar': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCuZKxrutaJ3DxiBK9gnOJlfriV5lPgvqmtw0DFco7nWqQgbvPHBolMeglqU3cE3uNor-fuUuaZq5t-bkWuavtvQapUcPBwHIyh6jo_BSPXJksmvvgjprFZiVv1Vvp02Tf8AqbXY3kMJeAB_ExOtTVLnP4cqE2EkDutAM26eTVXJcTMS1G0XFJPuM0ar3kUZE9_HB_VIrrujir7-IHCV_Ra_9Ztzn6f1g4tbzT04A',
      'Priya Kamat': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBp-5-gbiP_gHYgvAfNoSKDtSdIEVfP9Mo_mfeQVGWKIB55yjycOknJz4Fjjl0Yjzbw027gePaJ0_VsDlNJNdAV6OOZVG0rovpWtHXVR0CamURLB1EmJo62DRWcGU6o_MtXjtaywMGo6fAbmCqgIXN7H0p01r50KXNmVWQ4dWbhAE9n5MdkhPDSo2Bj6mdJXAMXNA6Ad49_SuZ-MUs8F-FRgsslrZpcALniqlMqfQ',
      'Anthony Fernandes': 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPrtqibJTLvRWSJzmzW3gmdkHuLfCiFHw2ZB22exrOb9ofQP73ntWNnk4_Lj8x3lm9uAeUCxnel7mqzjDANypDwkvTwlteN6CNQhhDmDqdElnW3yOX49PQHk7_LDwR32jcRDdcKLW4Bck5hj1thBiFqMmNEJos4pqEbTbXOliAiBFFkxqDsyN7XiMch2lPnYOqH-jB4Aytp54zv32oF5vDio-l8n9Xjbhc02AxBQ',
      'Sunita Rao': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsfC360j_vVpAXMU33dfo0MZrZ3MQbCrY-BnzqAVVpjB_gpXpoLvPNy9780XeZfH50VRBrUsJwb570kZhebxHDMQvJasPLhiJA5FLJfsH0KEbmfb9UPEjbNEm_hzKYwNqHsE_Y7XWzA3xkjc-iSXavhELtuh6QLpRe9X5xfwJPOwhZf4w7eCYK9FBKAjoEc5T6cAO7-7Ro4_JytU4KknUEJmFaDxyHQh3C3HxU9Q',
      'Michael Dsouza': 'https://lh3.googleusercontent.com/aida-public/AB6AXuA7BKGMmD_M_HCPpYGDBJU5reSItXUGqFCWPoji1vY6mftWPf-xHvR1pqaz3XwK4GzTV7p0AxELlOvsBRRv6XXrD8I49XHPbjC9YMke_3h0e-CFIvtbJULCgJ0u0AAeicdAFXK1jchHosyDJN-OMe10NKs_ezh4aRgdOVB_ehByDU7sT-CFHpuLmGha9fTgm3mjOb9wZ-vc3G6YkR6WSJAKufDPeJZL6lLdboC4BQ',
      'Unassigned': 'https://lh3.googleusercontent.com/aida-public/AB6AXuAYuf5ThWCtj7pbiidRxX44c7_Zei1tdmHaXFscoH85EO_oX0TcvB5pJbqVTUvGeO5ZgbeYYgwB-jT9koZGXCkQNuY1MZIlXVEWmzl2-OJ5Q6KlTrY5jx15t9hhh2Oqb5E2zi16JJ6YM6kkNJ8JvdiqUeG4NKjnVPtSjijOsnLgYv0Reap--37RcVehblDBl9jYB8kD5nnt3clD1NvfIKdll89Qt_QhFzJlcb-faA',
    };

    let activeCard = null;

    function updateTicketCounts() {
      const colNew = $('[data-column-status="New"]');
      const colInProg = $('[data-column-status="In progress"]');
      const colWait = $('[data-column-status="Waiting on guest"]');
      const colRes = $('[data-column-status="Resolved"]');

      const countNew = colNew ? $$('.cursor-pointer', colNew).length : 0;
      const countInProg = colInProg ? $$('.cursor-pointer', colInProg).length : 0;
      const countWait = colWait ? $$('.cursor-pointer', colWait).length : 0;
      const countRes = colRes ? $$('.cursor-pointer', colRes).filter((c) => !text(c).includes('more resolved')).length : 0;

      const badgeNew = $('#countColNew');
      if (badgeNew) badgeNew.textContent = countNew;
      const badgeInProg = $('#countColInProgress');
      if (badgeInProg) badgeInProg.textContent = countInProg;
      const badgeWait = $('#countColWaiting');
      if (badgeWait) badgeWait.textContent = countWait;
      const badgeRes = $('#countColResolved');
      if (badgeRes) badgeRes.textContent = countRes + 10;

      const activeBadge = $('#activeTicketsBadge');
      if (activeBadge) activeBadge.textContent = `${countNew + countInProg + countWait} Active`;
    }

    // Attach click listeners to all cards in board
    function wireCardClicks() {
      $$('.cursor-pointer', board).forEach((card) => {
        if (text(card).includes('more resolved')) return;
        card.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          activeCard = card;
          openTicketSlideOver(card);
        };
      });
    }

    function openTicketSlideOver(card) {
      const idEl = $('.font-label-md', card);
      const ticketId = idEl ? text(idEl) : '#TK-842';

      const roomSpan = $$('.text-label-sm', card).find((s) => text(s).startsWith('Room') || text(s).startsWith('Suite'));
      const room = roomSpan ? text(roomSpan) : 'Room 204';

      const prioritySpan = $$('.text-label-sm', card).find((s) => ['High', 'Medium', 'Low', 'Normal'].includes(text(s)));
      const priority = prioritySpan ? text(prioritySpan) : 'High';

      const titleEl = $('h3', card);
      const title = titleEl ? text(titleEl) : 'Ticket Issue';

      const colContainer = card.closest('[data-column-status]');
      const status = colContainer ? colContainer.dataset.columnStatus : 'New';

      const avatarImg = $('img', card);
      const assignee = card.dataset.assignee || (avatarImg && avatarImg.dataset.assignee) || 'Ramesh Kumar';

      // Populate slide-over
      const elId = $('#slideOverTicketId');
      if (elId) elId.textContent = ticketId;
      const elPri = $('#slideOverPriority');
      if (elPri) elPri.textContent = priority + ' Priority';
      const elRoom = $('#slideOverRoom');
      if (elRoom) elRoom.textContent = room;
      const elTitle = $('#slideOverTitle');
      if (elTitle) elTitle.textContent = title;

      const selAssignee = $('#ticketAssigneeSelect');
      if (selAssignee) selAssignee.value = assignee;
      const selStatus = $('#ticketStatusSelect');
      if (selStatus) selStatus.value = status;

      const resolveBtn = $('#markResolvedBtn');
      if (resolveBtn) {
        if (status === 'Resolved') {
          resolveBtn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Resolved';
          resolveBtn.disabled = true;
          resolveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          resolveBtn.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span> Mark as Resolved';
          resolveBtn.disabled = false;
          resolveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }

      // Show panel
      const overlay = $('#slideOverOverlay');
      const panel = $('#ticketSlideOver');
      if (overlay) overlay.classList.remove('hidden');
      if (panel) panel.classList.remove('translate-x-full');
    }

    window.openSlideOver = function (target) {
      const card = (target instanceof HTMLElement ? target : null) || window.event?.target?.closest('.group') || activeCard || $('.cursor-pointer', board);
      if (card) {
        activeCard = card;
        openTicketSlideOver(card);
      } else {
        const overlay = $('#slideOverOverlay');
        const panel = $('#ticketSlideOver');
        if (overlay) overlay.classList.remove('hidden');
        if (panel) panel.classList.remove('translate-x-full');
      }
    };

    window.closeSlideOver = function () {
      const overlay = $('#slideOverOverlay');
      const panel = $('#ticketSlideOver');
      if (overlay) overlay.classList.add('hidden');
      if (panel) panel.classList.add('translate-x-full');
    };

    window.saveTicketChanges = function () {
      if (!activeCard) {
        window.closeSlideOver();
        return;
      }
      const newAssignee = $('#ticketAssigneeSelect') ? $('#ticketAssigneeSelect').value : 'Ramesh Kumar';
      const newStatus = $('#ticketStatusSelect') ? $('#ticketStatusSelect').value : 'In progress';

      activeCard.dataset.assignee = newAssignee;
      const avatarImg = $('img', activeCard);
      if (avatarImg && STAFF_AVATARS[newAssignee]) {
        avatarImg.src = STAFF_AVATARS[newAssignee];
        avatarImg.alt = newAssignee;
        avatarImg.dataset.alt = newAssignee;
      }

      const currentCol = activeCard.closest('[data-column-status]');
      const currentStatus = currentCol ? currentCol.dataset.columnStatus : '';

      if (newStatus !== currentStatus) {
        const targetCol = $(`[data-column-status="${newStatus}"]`);
        if (targetCol) {
          targetCol.prepend(activeCard);
        }

        const h3 = $('h3', activeCard);
        const schedSpan = $('.material-symbols-outlined.text-xs', activeCard)?.parentElement;

        if (newStatus === 'Resolved') {
          activeCard.classList.add('opacity-75');
          if (h3) h3.classList.add('line-through');
          if (schedSpan) {
            schedSpan.className = 'text-label-sm text-emerald-600 flex items-center gap-1';
            schedSpan.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span>Resolved';
          }
        } else {
          activeCard.classList.remove('opacity-75');
          if (h3) h3.classList.remove('line-through');
          if (schedSpan) {
            schedSpan.className = 'text-label-sm text-on-surface-variant flex items-center gap-1';
            schedSpan.innerHTML = '<span class="material-symbols-outlined text-xs">schedule</span>Just now';
          }
        }

        updateTicketCounts();
      }

      // Add timeline entry
      const timeline = $('#slideOverTimeline');
      if (timeline) {
        const entry = document.createElement('div');
        entry.className = 'relative';
        entry.innerHTML = `
          <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#00ABE7]"></span>
          <p class="font-body-sm font-medium text-on-surface">Updated: ${newStatus} • Assigned to ${newAssignee}</p>
          <span class="text-label-sm text-on-surface-variant">Just now • Meera Prabhu (Manager)</span>
        `;
        timeline.prepend(entry);
      }

      window.closeSlideOver();
    };

    window.markTicketResolved = function () {
      if (!activeCard) {
        window.closeSlideOver();
        return;
      }
      const selStatus = $('#ticketStatusSelect');
      if (selStatus) selStatus.value = 'Resolved';

      // Add timeline entry
      const timeline = $('#slideOverTimeline');
      if (timeline) {
        const entry = document.createElement('div');
        entry.className = 'relative';
        entry.innerHTML = `
          <span class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <p class="font-body-sm font-medium text-on-surface">Marked as Resolved</p>
          <span class="text-label-sm text-on-surface-variant">Just now • Meera Prabhu (Manager)</span>
        `;
        timeline.prepend(entry);
      }

      window.saveTicketChanges();
    };

    window.openNewTicketModal = function () {
      const overlay = $('#newTicketModalOverlay');
      const modal = $('#newTicketModal');
      if (overlay) overlay.classList.remove('hidden');
      if (modal) modal.classList.remove('hidden');
    };

    window.closeNewTicketModal = function () {
      const overlay = $('#newTicketModalOverlay');
      const modal = $('#newTicketModal');
      if (overlay) overlay.classList.add('hidden');
      if (modal) modal.classList.add('hidden');
    };

    window.submitNewTicket = function () {
      const room = $('#newTicketRoom')?.value.trim() || 'Room 301';
      const title = $('#newTicketTitle')?.value.trim() || 'Guest Service Request';
      const category = $('#newTicketCategory')?.value || 'Maintenance';
      const priority = $('#newTicketPriority')?.value || 'Normal';

      const idNum = Math.floor(844 + Math.random() * 50);
      const ticketId = `#TK-${idNum}`;

      const priColor = priority === 'High' ? 'bg-[#ffdad5] text-[#8a1a12] border-l-2 border-[#EE6352]' : 'bg-surface-container text-on-surface-variant';
      const catIcon = category === 'Maintenance' ? 'ac_unit' : category === 'Housekeeping' ? 'room_service' : category === 'Concierge' ? 'near_me' : 'restaurant';

      const newCard = document.createElement('div');
      newCard.className = 'bg-surface-container-lowest p-4 rounded-xl shadow-[0_4px_12px_rgba(12,27,51,0.06)] cursor-pointer hover:shadow-md transition-all group';
      newCard.dataset.assignee = 'Ramesh Kumar';
      newCard.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="font-label-md text-on-surface-variant font-bold">${ticketId}</span>
          <span class="text-label-sm text-on-surface-variant flex items-center gap-1"><span class="material-symbols-outlined text-xs">schedule</span>Just now</span>
        </div>
        <div class="flex items-center gap-2 mb-2">
          <span class="bg-surface-container text-on-surface text-label-sm px-2 py-0.5 rounded-md font-medium">${room}</span>
          <span class="text-label-sm px-2 py-0.5 rounded-md ${priColor}">${priority}</span>
        </div>
        <h3 class="font-headline-sm text-on-surface mb-3 group-hover:text-[#00ABE7] transition-colors">${title}</h3>
        <div class="flex items-center justify-between pt-2">
          <div class="flex items-center gap-1.5 text-on-surface-variant text-body-sm">
            <span class="material-symbols-outlined text-sm text-[#00ABE7]">${catIcon}</span>
            <span>${category}</span>
          </div>
          <img class="w-6 h-6 rounded-full object-cover" src="${STAFF_AVATARS['Ramesh Kumar']}" alt="Ramesh Kumar"/>
        </div>
      `;

      newCard.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeCard = newCard;
        openTicketSlideOver(newCard);
      };

      const newCol = $('[data-column-status="New"]');
      if (newCol) newCol.prepend(newCard);

      updateTicketCounts();
      window.closeNewTicketModal();
    };

    wireCardClicks();

    // Kanban / List view toggle
    const columns = Array.from(board.children);
    const kanbanCls = board.className;
    const viewBtns = $$('button').filter((b) => ['view_kanban', 'view_list'].includes(iconOf(b)));

    tabGroup(viewBtns, 0, (i) => {
      const list = i === 1;
      board.className = list ? 'flex flex-col gap-4' : kanbanCls;
      columns.forEach((col) => {
        col.style.width = list ? '100%' : '';
        const body = col.children[1];
        if (body) {
          body.style.maxHeight = list ? 'none' : '';
          body.style.overflow = list ? 'visible' : '';
        }
      });
    });
  }

  function boot() {
    wireSidebar();
    initDashboard();
    initConversations();
    initTickets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
