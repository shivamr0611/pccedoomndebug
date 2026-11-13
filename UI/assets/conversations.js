/* Conversations page: real guests and messages from Supabase, served by the WhatsApp backend. */
(function () {
  'use strict';

  const API = 'http://127.0.0.1:3001/api/conversations';
  const POLL_MS = 5000;

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt; // textContent only: message bodies are untrusted guest input
    return e;
  };

  const state = { list: [], guests: [], filter: 'all', query: '', selectedId: null, selectedGuestId: null, detail: null, failed: false, actionError: null };

  const labelOf = (c) => c.code || String(c.id).slice(0, 8).toUpperCase();
  const nameOf = (c) => (c.guests && c.guests.name) || phoneOf(c);
  function phoneOf(c) {
    const p = (c.guests && c.guests.phone) || '';
    const m = p.match(/^\+91(\d{5})(\d{5})$/);
    return m ? '+91 ' + m[1] + ' ' + m[2] : p || 'Unknown';
  }
  const initials = (s) => {
    const parts = String(s).replace(/[^A-Za-z\u0900-\u097F ]/g, '').trim().split(/\s+/).filter(Boolean);
    return (parts.length ? parts.slice(0, 2).map((w) => w[0]).join('') : '#').toUpperCase();
  };

  function fmtTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  const fmtFull = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  function avatar(text, size) {
    return el('div', size + ' rounded-full bg-[#00ABE7]/20 text-[#00ABE7] flex items-center justify-center font-bold flex-shrink-0', initials(text));
  }

  function statusBadge(status) {
    return status === 'open'
      ? el('span', 'bg-surface-container-high text-on-surface-variant text-[10px] font-medium px-1.5 py-0.5 rounded', 'Open')
      : el('span', 'bg-emerald-500/20 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded', 'Closed');
  }

  /* ---------- left column ---------- */
  function visibleList() {
    const q = state.query;
    return state.list.filter((c) => {
      if (state.filter !== 'all' && c.status !== state.filter) return false;
      if (!q) return true;
      const hay = [nameOf(c), (c.guests && c.guests.phone) || '', c.code || '', c.id, c.last_message ? c.last_message.body : ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function renderList() {
    const box = $('#convList');
    box.replaceChildren();
    for (const key of ['all', 'open', 'closed']) {
      const n = key === 'all' ? state.list.length : state.list.filter((c) => c.status === key).length;
      const span = $('[data-count="' + key + '"]');
      if (span) span.textContent = state.list.length || !state.failed ? '(' + n + ')' : '';
    }
    const open = state.list.filter((c) => c.status === 'open').length;
    const badge = $('aside a[data-path="conversations"] span.rounded-full');
    if (badge) badge.textContent = String(open);

    if (state.failed) {
      box.append(el('p', 'text-body-sm text-[#EE6352] p-3', 'Cannot reach the backend. Is "node server.js" running in backend/whatsapp?'));
      return;
    }
    const rows = visibleList();
    const q = state.query;
    const withTickets = new Set(state.list.map((c) => c.guests && c.guests.id));
    const lonely = state.filter !== 'all' ? [] : state.guests.filter((g) => !withTickets.has(g.id) && (!q || [g.name || '', g.phone, g.id].join(' ').toLowerCase().includes(q)));
    if (!rows.length && !lonely.length) {
      box.append(el('p', 'text-body-sm text-outline p-3', state.list.length || state.guests.length ? 'Nothing matches.' : 'Nothing in Supabase yet. A guest starts a conversation by sending a message on WhatsApp.'));
      return;
    }
    // Group by guest (rows are already newest first); each conversation is a ticket labelled by its id.
    const groups = new Map();
    for (const c of rows) {
      const gid = (c.guests && c.guests.id) || c.id;
      if (!groups.has(gid)) groups.set(gid, []);
      groups.get(gid).push(c);
    }
    for (const convs of groups.values()) {
      const g = convs[0];
      const wrap = el('div', 'rounded-xl bg-surface-container-low p-2');
      const head = el('div', 'flex items-center gap-3 px-1 pb-2');
      head.append(avatar(nameOf(g), 'w-9 h-9 text-xs'));
      const who = el('div', 'flex-1 min-w-0');
      who.append(el('div', 'text-headline-sm font-semibold text-on-surface truncate', nameOf(g)));
      who.append(el('div', 'text-label-sm text-outline truncate', (g.guests && g.guests.name ? phoneOf(g) + ' \u2022 ' : '') + convs.length + (convs.length === 1 ? ' ticket' : ' tickets')));
      head.append(who);
      wrap.append(head);

      for (const c of convs) {
        const active = c.id === state.selectedId;
        const row = el('div', 'p-2.5 mb-1 last:mb-0 rounded-lg cursor-pointer transition-all ' + (active ? 'bg-surface-container shadow-sm' : 'bg-surface-container-lowest hover:bg-surface-container'));
        row.title = c.id;
        if (active) row.style.borderLeft = '4px solid #EE6352';
        const top = el('div', 'flex items-center justify-between gap-2 mb-1');
        top.append(el('span', 'font-mono text-[12px] font-bold text-on-surface', '#' + labelOf(c)), el('span', 'text-label-sm text-outline', fmtTime(c.last_activity)));
        const preview = c.last_message ? (c.last_message.sender === 'guest' ? '' : c.last_message.sender === 'ai' ? 'AI: ' : 'Staff: ') + c.last_message.body : 'No messages yet';
        const tags = el('div', 'flex items-center gap-2 mt-1.5');
        tags.append(statusBadge(c.status), el('span', 'text-[10px] text-outline', c.message_count + ' msg'));
        row.append(top, el('p', 'text-body-sm text-on-surface-variant truncate', preview.replace(/\s+/g, ' ')), tags);
        row.addEventListener('click', () => select(c.id));
        wrap.append(row);
      }
      box.append(wrap);
    }
    for (const g of lonely) {
      const active = g.id === state.selectedGuestId;
      const card = el('div', 'rounded-xl p-3 cursor-pointer transition-all ' + (active ? 'bg-surface-container shadow-sm' : 'bg-surface-container-low hover:bg-surface-container'));
      if (active) card.style.borderLeft = '4px solid #EE6352';
      const inner = el('div', 'flex items-center gap-3');
      inner.append(avatar(g.name || g.phone, 'w-9 h-9 text-xs'));
      const who = el('div', 'flex-1 min-w-0');
      who.append(el('div', 'text-headline-sm font-semibold text-on-surface truncate', g.name || g.phone), el('div', 'text-label-sm text-outline truncate', (g.name ? g.phone + ' \u2022 ' : '') + 'no tickets yet'));
      inner.append(who);
      card.append(inner);
      card.addEventListener('click', () => selectGuest(g.id));
      box.append(card);
    }
  }

  /* ---------- center + right columns ---------- */
  function renderChat() {
    const d = state.detail;
    const head = $('#chatHeader');
    const msgs = $('#messages');
    const panel = $('#guestPanel');
    head.replaceChildren();
    const lone = !d && state.selectedGuestId ? state.guests.find((g) => g.id === state.selectedGuestId) : null;
    if (lone) {
      head.append(avatar(lone.name || lone.phone, 'w-10 h-10 text-sm'));
      const info = el('div');
      info.append(el('div', 'text-headline-sm font-semibold text-on-surface', lone.name || lone.phone), el('div', 'text-body-sm text-outline', lone.name ? lone.phone : 'Guest with no tickets yet'));
      head.append(info);
      msgs.dataset.cid = '';
      msgs.replaceChildren(el('p', 'text-body-sm text-outline text-center mt-10', 'This guest has no conversations yet. They start one by sending a message on WhatsApp.'));
      panel.replaceChildren(dataCard('Guest record (guests table)', lone));
      return;
    }
    if (!d) {
      head.append(el('span', 'text-body-sm text-outline', 'Select a conversation'));
      msgs.replaceChildren(el('p', 'text-body-sm text-outline text-center mt-10', 'Select a conversation to see its messages.'));
      panel.replaceChildren(el('p', 'text-body-sm text-outline', 'Guest details appear here.'));
      return;
    }
    const name = nameOf(d);
    head.append(avatar(name, 'w-10 h-10 text-sm'));
    const info = el('div');
    const line = el('div', 'flex items-center gap-2');
    line.append(el('span', 'text-headline-sm font-semibold text-on-surface', name));
    if (d.guests && d.guests.name) line.append(el('span', 'text-body-sm text-outline', phoneOf(d)));
    const sub = el('div', 'flex items-center gap-2 mt-0.5');
    sub.append(el('span', 'font-mono bg-surface-container px-2 py-0.5 rounded text-[11px] font-bold text-on-surface', 'Ticket #' + labelOf(d)), el('span', 'bg-surface-container px-2 py-0.5 rounded text-[11px] font-medium text-on-surface-variant', 'WhatsApp'), statusBadge(d.status));
    info.append(line, sub);
    head.append(info);

    const nearBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
    const firstRender = msgs.dataset.cid !== d.id;
    msgs.replaceChildren();
    msgs.dataset.cid = d.id;
    msgs.append(note('Conversation started ' + fmtFull(d.started_at)));
    if (!d.messages.length) msgs.append(el('p', 'text-body-sm text-outline text-center', 'No messages in this conversation yet.'));
    for (const m of d.messages) msgs.append(bubble(m, name));
    if (d.status === 'closed' && d.closed_at) msgs.append(note('Conversation closed ' + fmtFull(d.closed_at)));
    if (firstRender || nearBottom) msgs.scrollTop = msgs.scrollHeight;

    renderPanel(d, name);
  }

  function note(text) {
    const w = el('div', 'flex justify-center my-2');
    w.append(el('div', 'bg-surface-container text-on-surface-variant px-4 py-1.5 rounded-full text-label-md font-medium', text));
    return w;
  }

  function bubble(m, guestName) {
    const guest = m.sender === 'guest';
    const row = el('div', 'flex items-end gap-2 max-w-[70%] ' + (guest ? '' : 'ml-auto flex-row-reverse'));
    if (guest) row.append(avatar(guestName, 'w-7 h-7 text-[10px] mb-1'));
    else row.append(el('div', 'w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] mb-1 ' + (m.sender === 'ai' ? 'bg-[#00ABE7]/20 text-[#00ABE7]' : 'bg-primary/10 text-primary'), m.sender === 'ai' ? 'AI' : 'ST'));
    const box = el('div', 'p-3.5 shadow-sm ' + (guest ? 'bg-surface-container-lowest rounded-2xl rounded-bl-sm' : m.sender === 'ai' ? 'bg-[#00ABE7]/10 rounded-2xl rounded-br-sm' : 'bg-primary/10 rounded-2xl rounded-br-sm'));
    if (!guest) box.append(el('div', 'mb-1 text-[10px] font-bold ' + (m.sender === 'ai' ? 'text-[#00ABE7]' : 'text-primary'), m.sender === 'ai' ? 'AI response' : 'Staff'));
    const p = el('p', 'text-body-md text-on-surface', m.body);
    p.style.whiteSpace = 'pre-wrap';
    p.style.overflowWrap = 'anywhere';
    box.title = 'id: ' + m.id + '\nprovider_message_id: ' + (m.provider_message_id || '-') + '\ncreated_at: ' + m.created_at;
    box.append(p, el('span', 'text-[10px] text-outline mt-1 block text-right', fmtTime(m.created_at)));
    row.append(box);
    return row;
  }

  function renderPanel(d, name) {
    const panel = $('#guestPanel');
    const card = el('div', 'bg-surface-container p-4 rounded-xl flex flex-col items-center text-center');
    card.append(avatar(name, 'w-16 h-16 text-xl mb-3'), el('h3', 'text-headline-sm font-bold text-on-surface', name), el('p', 'text-body-sm text-outline mb-3', phoneOf(d)));
    const grid = el('div', 'w-full grid grid-cols-2 gap-2 pt-3 border-t border-outline-variant/20 text-left');
    const cell = (label, value) => {
      const c = el('div');
      c.append(el('span', 'text-[10px] text-outline block', label), el('span', 'text-body-sm font-medium text-on-surface', value));
      return c;
    };
    grid.append(
      cell('Preferred Lang', (d.guests && d.guests.preferred_language) || 'Not set'),
      cell('Messages', String(d.messages.length)),
      cell('Started', fmtFull(d.started_at)),
      cell('Status', d.status === 'open' ? 'Open' : 'Closed ' + (d.closed_at ? fmtFull(d.closed_at) : ''))
    );
    card.append(grid);

    const sum = el('div', 'bg-[#00ABE7]/10 p-4 rounded-xl');
    const sh = el('div', 'flex items-center gap-2 mb-3 text-[#00ABE7]');
    sh.append(el('span', 'material-symbols-outlined text-lg', 'auto_awesome'), el('h4', 'text-headline-sm font-bold text-on-surface', 'AI Summary'));
    const st = el('p', 'text-body-sm text-on-surface-variant', d.summary || 'A summary will appear here after the conversation is closed.');
    st.style.whiteSpace = 'pre-wrap';
    sum.append(sh, st);

    const idBox = el('div', 'bg-surface-container p-4 rounded-xl');
    idBox.append(el('span', 'text-[10px] text-outline block mb-1', 'Conversation ID'), el('code', 'text-body-md font-bold text-on-surface', d.code || d.id), el('div', 'text-[10px] text-outline break-all mt-1', d.id));

    const deleteButton = el('button', 'w-full rounded-lg border border-error px-4 py-2 text-sm font-semibold text-error hover:bg-error-container', 'Delete conversation');
    deleteButton.type = 'button';
    deleteButton.addEventListener('click', () => deleteConversation(d, deleteButton));
    const actions = el('div', 'space-y-2');
    actions.append(deleteButton);
    if (state.actionError) actions.append(el('p', 'text-sm text-error', state.actionError));

    const cards = [card, sum, idBox, dataCard('Conversation record (conversations table)', d), actions];
    if (d.guests) cards.push(dataCard('Guest record (guests table)', d.guests));
    panel.replaceChildren(...cards);
  }

  /* Every column stored in Supabase for one row. Joined/nested rows are skipped (they have their own card). */
  function dataCard(title, row) {
    const box = el('div', 'bg-surface-container p-4 rounded-xl');
    box.append(el('h4', 'text-headline-sm font-semibold text-on-surface mb-2', title));
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && typeof value === 'object') continue;
      const line = el('div', 'py-1.5 border-b border-outline-variant/20 last:border-0');
      line.append(el('span', 'text-[10px] text-outline block', key), el('span', 'text-body-sm text-on-surface break-all', value === null ? 'null' : String(value)));
      box.append(line);
    }
    return box;
  }

  /* ---------- data ---------- */
  async function api(path, options = {}) {
    const r = await fetch(API + path, { cache: 'no-store', ...options });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
    return data;
  }

  async function loadDetail() {
    if (!state.selectedId) return;
    try {
      state.detail = await api('/' + encodeURIComponent(state.selectedId));
    } catch (e) {
      state.detail = null;
    }
    renderChat();
  }

  async function select(id) {
    state.selectedId = id;
    state.selectedGuestId = null;
    state.actionError = null;
    renderList();
    await loadDetail();
  }

  function selectGuest(id) {
    state.selectedGuestId = id;
    state.selectedId = null;
    state.detail = null;
    state.actionError = null;
    renderList();
    renderChat();
  }

  async function deleteConversation(conversation, button) {
    if (!window.confirm(`Permanently delete conversation #${labelOf(conversation)} and all its messages from Supabase?`)) return;
    state.actionError = null;
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      await api('/' + encodeURIComponent(conversation.id), { method: 'DELETE' });
      state.list = state.list.filter((item) => item.id !== conversation.id);
      state.selectedId = null;
      state.detail = null;
      await refresh();
    } catch (error) {
      state.actionError = error.message || 'Could not delete the conversation.';
      renderChat();
    }
  }

  async function refresh() {
    try {
      const data = await api('');
      state.list = data.conversations;
      state.guests = data.guests || [];
      state.failed = false;
    } catch (e) {
      state.failed = true;
    }
    if (!state.selectedId && !state.selectedGuestId && state.list.length) state.selectedId = state.list[0].id;
    renderList();
    if (state.selectedId && !state.failed) await loadDetail();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!$('#convList')) return;
    $('#convSearch').addEventListener('input', (e) => {
      state.query = e.target.value.trim().toLowerCase();
      renderList();
    });
    const tabs = Array.from(document.querySelectorAll('#convTabs button'));
    tabs.forEach((b) =>
      b.addEventListener('click', () => {
        state.filter = b.dataset.filter;
        tabs.forEach((x) => {
          x.className = 'px-3 py-1.5 rounded-lg text-label-md font-medium whitespace-nowrap ' + (x === b ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container');
        });
        renderList();
      })
    );
    refresh();
    setInterval(refresh, POLL_MS);
  });
})();
