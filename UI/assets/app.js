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
    settings: 'settings',
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
    $$('aside a[data-path]').forEach((a) => {
      const folder = PAGES[a.dataset.path];
      if (!folder) {
        a.remove();
        return;
      }
      a.href = '../' + folder + '/code.html';
      const pre = document.createElement('link');
      pre.rel = 'prefetch';
      pre.href = a.href;
      document.head.appendChild(pre);
    });
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

  /* Knowledge base: vertical tabs swap the data table */
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
    const names = tabs.map((a) => text(a).replace(/\d+$/, '').trim());

    function render(name) {
      const d = KB[name];
      if (!d) return;
      $('h2', main).textContent = d.title;
      $('h2 + p', main).textContent = d.desc;
      $('thead tr', table).innerHTML = d.cols.map((c) => '<th class="p-3">' + c + '</th>').join('') + '<th class="p-3 text-right">Actions</th>';
      $('tbody', table).innerHTML = d.rows
        .map((r) => {
          const cells = r.slice(0, -1).map((v, i) => '<td class="p-3' + (i === 0 ? ' font-medium' : '') + '">' + v + '</td>').join('');
          const status = '<td class="p-3"><span class="px-2 py-0.5 rounded-full ' + KB_STATUS[r[r.length - 1]] + '">' + r[r.length - 1] + '</span></td>';
          return '<tr class="hover:bg-surface-container-low/50 transition-colors">' + cells + status +
            '<td class="p-3 text-right"><div class="flex items-center justify-end gap-1">' +
            '<button class="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant"><span class="material-symbols-outlined text-sm">edit</span></button>' +
            '<button class="p-1.5 rounded hover:bg-surface-container-high text-on-surface-variant"><span class="material-symbols-outlined text-sm">delete</span></button>' +
            '</div></td></tr>';
        })
        .join('');
    }

    tabGroup(tabs, 0, (i) => render(names[i]));
    render(names[0]);
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
    initKnowledgeBase();
    initTickets();
  });
})();
