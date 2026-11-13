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

  function wireSidebar() {
    enablePageTransitions();
    const profileLink = $('aside a[data-path="settings"]');
    if (profileLink) {
      profileLink.dataset.path = 'profile';
      const icon = $('.material-symbols-outlined', profileLink);
      if (icon) icon.textContent = 'person';
      const label = Array.from(profileLink.childNodes).find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
      );
      if (label) label.textContent = label.textContent.replace('Settings', 'Profile');
    }

    const currentFolder = location.pathname.split('/').slice(-2, -1)[0];
    const currentPage = Object.keys(PAGES).find((page) => PAGES[page] === currentFolder);
    const activeClasses = ['bg-secondary', 'text-on-secondary', 'font-bold'];
    const inactiveClasses = [
      'text-primary-fixed-dim',
      'hover:bg-surface-container-high',
      'hover:text-on-surface',
    ];
    const legacyClasses = ['bg-[#ac3327]', 'text-white', 'font-semibold', 'text-slate-200', 'hover:bg-white/10'];

    $$('aside a[data-path]').forEach((a) => {
      const folder = PAGES[a.dataset.path];
      if (!folder) {
        a.remove();
        return;
      }
      a.href = '../' + folder + '/code.html';
      a.classList.remove(...activeClasses, ...inactiveClasses, ...legacyClasses);
      a.classList.add('rounded-xl');
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

  /* Dashboard: 7D / 14D / 30D period switch */
  function initDashboard() {
    const periods = $$('button').filter((b) => ['7D', '14D', '30D'].includes(text(b)));
    tabGroup(periods, periods.findIndex((b) => text(b) === '14D'), () => {});
  }

  /* Conversations: status filter tabs + search + row selection */
  function initConversations() {
    if (document.body.dataset.liveConversations) return; // rendered from Supabase by conversations.js
    const search = $('input[placeholder^="Search conversations"]');
    if (!search) return;
    const list = $('.space-y-2.overflow-y-auto');
    const left = list.parentElement;
    const center = left.nextElementSibling;
    const right = center.nextElementSibling;
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
        $('.text-headline-sm', center).textContent = name;
        $('h3', right).textContent = name;
      })
    );
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

  document.addEventListener('DOMContentLoaded', () => {
    wireSidebar();
    initDashboard();
    initConversations();
    initTickets();
  });
})();
