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
    tickets: 'tickets',
    guests: 'guests',
    'knowledge-base': 'knowledge_base',
    analytics: 'analytics',
    'triggers-and-alerts': 'triggers_alerts',
    settings: 'settings',
    message: 'message',
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

  function wireSidebar() {
    enablePageTransitions();
    const sideNav = $('aside nav');
    if (sideNav && !$('a[data-path="message"]', sideNav)) {
      const link = $('a[data-path="settings"]', sideNav).cloneNode(true);
      link.dataset.path = 'message';
      link.lastChild.textContent = 'Message';
      $('.material-symbols-outlined', link).textContent = 'send';
      sideNav.appendChild(link);
    }
    if (location.pathname.includes('/message/')) {
      const cur = $('aside a[data-path="dashboard"]');
      const me = $('aside a[data-path="message"]');
      if (cur && me) {
        const activeCls = cur.className;
        cur.className = $('aside a[data-path="settings"]').className;
        cur.removeAttribute('aria-current');
        me.className = activeCls;
      }
    }
    $$('aside a[data-path]').forEach((a) => {
      const folder = PAGES[a.dataset.path];
      if (!folder) return;
      a.href = '../' + folder + '/code.html';
      const pre = document.createElement('link');
      pre.rel = 'prefetch';
      pre.href = a.href;
      document.head.appendChild(pre);
    });
  }

  /* Dashboard: 7D / 14D / 30D period switch + Needs attention row edit & takeover & delete */
  function initDashboard() {
    const periods = $$('button').filter((b) => ['7D', '14D', '30D'].includes(text(b)));
    if (periods.length) {
      tabGroup(periods, periods.findIndex((b) => text(b) === '14D'), () => {});
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

  /* Knowledge base: vertical tabs swap the data table + working edit & delete modals */
  const KB_STATUS = {
    Immediate: 'bg-emerald-500/10 text-emerald-700',
    Limited: 'bg-amber-500/10 text-amber-700',
    'Sold Out': 'bg-error/10 text-error',
  };
  const KB = {
    'Rooms and Rates': {
      title: 'Rooms and Rates Data',
      desc: 'Manage base rates, peak pricing, and availability details used by the AI assistant.',
      cols: ['Room Type', 'Base Rate', 'Peak Rate', 'Cap.', 'Availability'],
      rows: [
        ['Deluxe Sea View', '₹8,500', '₹14,000', '2 Adults', 'Immediate'],
        ['Executive Suite', '₹14,000', '₹22,000', '3 Adults', 'Limited'],
        ['Standard Cottage', '₹5,500', '₹9,500', '2 Adults', 'Immediate'],
        ['Beach Villa Pool', '₹24,000', '₹38,000', '4 Adults', 'Sold Out'],
      ],
    },
    Amenities: {
      title: 'Amenities Data',
      desc: 'Facilities, timings and prices the AI can share with guests.',
      cols: ['Amenity', 'Timings', 'Location', 'Cost', 'Availability'],
      rows: [
        ['Infinity Pool', '6 AM - 10 PM', 'Level 2', 'Free', 'Immediate'],
        ['Spa & Wellness', '9 AM - 8 PM', 'Wing B', 'From ₹2,500', 'Limited'],
        ['Beach Shack', '8 AM - 11 PM', 'Beachfront', 'A la carte', 'Immediate'],
        ['Fitness Centre', '24x7', 'Level 1', 'Free', 'Immediate'],
      ],
    },
    Policies: {
      title: 'Policies Data',
      desc: 'Check-in, cancellation and stay policies the AI quotes to guests.',
      cols: ['Policy', 'Details', 'Applies To', 'Updated', 'Availability'],
      rows: [
        ['Check-in', '2 PM, early on request', 'All guests', 'Jan 2024', 'Immediate'],
        ['Check-out', '11 AM, late until 2 PM with fee', 'All guests', 'Jan 2024', 'Immediate'],
        ['Cancellation', 'Free until 72h before arrival', 'All bookings', 'Feb 2024', 'Immediate'],
        ['Extra bed', '₹1,500 per night', 'Rooms only', 'Mar 2024', 'Limited'],
      ],
    },
    'Nearby Places': {
      title: 'Nearby Places Data',
      desc: 'Points of interest and distances for concierge answers.',
      cols: ['Place', 'Type', 'Distance', 'Open Hours', 'Availability'],
      rows: [
        ['Calangute Beach', 'Beach', '0.2 km', '24x7', 'Immediate'],
        ['Fort Aguada', 'Heritage', '7 km', '9 AM - 5:30 PM', 'Immediate'],
        ['Baga Night Market', 'Market', '3 km', '6 PM - 11 PM', 'Limited'],
        ['Dabolim Airport', 'Transport', '42 km', '24x7', 'Immediate'],
      ],
    },
    FAQs: {
      title: 'FAQs Data',
      desc: 'Common guest questions with approved answers.',
      cols: ['Question', 'Answer', 'Category', 'Language', 'Availability'],
      rows: [
        ['Is breakfast included?', 'Yes, for all room types', 'Dining', 'EN', 'Immediate'],
        ['Is there Wi-Fi?', 'Free high-speed Wi-Fi throughout', 'Services', 'EN', 'Immediate'],
        ['Do you offer airport pickup?', 'Yes, ₹1,800 each way', 'Transport', 'EN', 'Limited'],
        ['Parking available?', 'Free for in-house guests', 'Services', 'EN', 'Immediate'],
      ],
    },
  };

  function initKnowledgeBase() {
    const table = $('table');
    const grid = $('.grid.grid-cols-12');
    if (!table || !grid) return;
    const tabsCol = grid.children[0];
    const main = grid.children[1];
    const tabs = $$('a', tabsCol);
    const names = tabs.map((a) => {
      const span = $('div > span:last-child', a);
      return span ? text(span) : text(a).replace(/\d+$/, '').trim();
    });

    let activeCategory = names[0] || 'Rooms and Rates';

    window.closeKbModal = function () {
      const m = $('#kbEditModal');
      if (m) m.classList.add('hidden');
    };

    function openKbEditModal(category, rowIndex) {
      const d = KB[category];
      if (!d) return;
      const isNew = rowIndex === -1;
      const rowData = isNew ? d.cols.map(() => '') : d.rows[rowIndex];

      const modalTitle = $('#kbModalTitle');
      if (modalTitle) modalTitle.textContent = isNew ? `Add New ${category} Item` : `Edit ${category} Item`;
      const fieldsContainer = $('#kbModalFields');
      if (!fieldsContainer) return;

      fieldsContainer.innerHTML = d.cols.map((colName, colIdx) => {
        const val = rowData[colIdx] || '';
        if (colName === 'Availability') {
          return `
            <div>
              <label class="text-label-md text-on-surface-variant font-medium block mb-1">${colName}</label>
              <select class="kb-input w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface outline-none focus:border-secondary transition-all" data-col="${colIdx}">
                <option value="Immediate" ${val === 'Immediate' ? 'selected' : ''}>Immediate</option>
                <option value="Limited" ${val === 'Limited' ? 'selected' : ''}>Limited</option>
                <option value="Sold Out" ${val === 'Sold Out' ? 'selected' : ''}>Sold Out</option>
              </select>
            </div>
          `;
        }
        return `
          <div>
            <label class="text-label-md text-on-surface-variant font-medium block mb-1">${colName}</label>
            <input type="text" value="${val.replace(/"/g, '&quot;')}" class="kb-input w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface outline-none focus:border-secondary transition-all" data-col="${colIdx}"/>
          </div>
        `;
      }).join('');

      const saveBtn = $('#kbModalSaveBtn');
      if (saveBtn) {
        saveBtn.onclick = () => {
          const newRow = [];
          $$('.kb-input', fieldsContainer).forEach((input) => {
            newRow.push(input.value.trim());
          });
          if (isNew) {
            d.rows.push(newRow);
          } else {
            d.rows[rowIndex] = newRow;
          }
          render(category);
          window.closeKbModal();
        };
      }

      const modal = $('#kbEditModal');
      if (modal) modal.classList.remove('hidden');
    }

    // Connect Add New button
    const addBtn = $('#kbAddBtn') || $$('button', main).find((b) => /add/i.test(text(b)));
    if (addBtn) {
      addBtn.onclick = (e) => {
        e.preventDefault();
        openKbEditModal(activeCategory, -1);
      };
    }

    // Event delegation on table for Edit and Delete buttons
    table.onclick = (e) => {
      const editBtn = e.target.closest('button[data-action="edit"]');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        const rowIdx = parseInt(editBtn.dataset.row, 10);
        openKbEditModal(activeCategory, isNaN(rowIdx) ? 0 : rowIdx);
        return;
      }
      const delBtn = e.target.closest('button[data-action="delete"]');
      if (delBtn) {
        e.preventDefault();
        e.stopPropagation();
        const rowIdx = parseInt(delBtn.dataset.row, 10);
        const d = KB[activeCategory];
        if (d) {
          const idx = isNaN(rowIdx) ? 0 : rowIdx;
          if (confirm(`Delete this item from ${activeCategory}?`)) {
            d.rows.splice(idx, 1);
            render(activeCategory);
          }
        }
        return;
      }
    };

    function render(name) {
      activeCategory = name;
      const d = KB[name];
      if (!d) return;

      const titleEl = $('h2', main);
      if (titleEl) titleEl.textContent = d.title;
      const descEl = $('h2 + p', main);
      if (descEl) descEl.textContent = d.desc;

      const theadTr = $('thead tr', table);
      if (theadTr) {
        theadTr.innerHTML = d.cols.map((c) => '<th class="p-3">' + c + '</th>').join('') + '<th class="p-3 text-right">Actions</th>';
      }

      const tbody = $('tbody', table);
      if (tbody) {
        tbody.innerHTML = d.rows
          .map((r, rowIndex) => {
            const cells = r.slice(0, -1).map((v, i) => '<td class="p-3' + (i === 0 ? ' font-medium' : '') + '">' + v + '</td>').join('');
            const status = '<td class="p-3"><span class="px-2 py-0.5 rounded-full ' + (KB_STATUS[r[r.length - 1]] || 'bg-surface-container text-on-surface-variant') + '">' + r[r.length - 1] + '</span></td>';
            return '<tr class="hover:bg-surface-container-low/50 transition-colors">' + cells + status +
              '<td class="p-3 text-right"><div class="flex items-center justify-end gap-1">' +
              '<button data-action="edit" data-row="' + rowIndex + '" class="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all" title="Edit item"><span class="material-symbols-outlined text-sm">edit</span></button>' +
              '<button data-action="delete" data-row="' + rowIndex + '" class="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant hover:text-error transition-all" title="Delete item"><span class="material-symbols-outlined text-sm">delete</span></button>' +
              '</div></td></tr>';
          })
          .join('');
      }
    }

    // Wire vertical tabs navigation
    tabs.forEach((tab, i) => {
      tab.onclick = (e) => {
        e.preventDefault();
        tabs.forEach((t) => {
          t.className = 'flex items-center justify-between px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-headline-sm transition-all';
          const icon = $('span.material-symbols-outlined', t);
          if (icon) icon.style.fontVariationSettings = "'FILL' 0";
          const badge = $('.text-label-sm', t);
          if (badge) badge.className = 'text-label-sm text-on-surface-variant/60';
        });
        tab.className = 'flex items-center justify-between px-4 py-3 rounded-lg bg-secondary text-on-secondary font-headline-sm transition-all shadow-xs';
        const icon = $('span.material-symbols-outlined', tab);
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        const badge = $('.text-label-sm', tab);
        if (badge) badge.className = 'text-label-sm bg-on-secondary/20 px-2 py-0.5 rounded-full';
        render(names[i]);
      };
    });

    render(names[0] || 'Rooms and Rates');
  }

  /* Tickets: Kanban / List view toggle */
  function initTickets() {
    const cards = $$('[onclick="openSlideOver()"]');
    if (!cards.length) return;
    const board = cards[0].parentElement.parentElement.parentElement;
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
    initKnowledgeBase();
    initTickets();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
