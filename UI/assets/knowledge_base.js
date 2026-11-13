(function () {
  'use strict';

  const API = 'http://127.0.0.1:3001/api/knowledge-base';
  const $ = (selector, root = document) => root.querySelector(selector);
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  };
  const state = { items: [], category: 'All items', query: '' };
  const buttonClass = 'rounded-lg px-3 py-2 text-sm font-semibold transition';

  async function request(path = '', options = {}) {
    const response = await fetch(API + path, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Knowledge-base request failed (${response.status}).`);
    return data;
  }

  function makeButton(label, className, onClick) {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function buildLayout(grid) {
    grid.className = 'grid grid-cols-1 gap-6 items-start xl:grid-cols-[220px_minmax(0,1fr)_320px]';
    grid.replaceChildren();

    const categories = el('aside', 'rounded-xl bg-surface-container-low p-3 shadow-sm');
    categories.id = 'kbCategories';
    const main = el('section', 'min-w-0 rounded-xl bg-surface-container-low p-5 shadow-sm');
    main.innerHTML =
      '<div class="mb-5 flex flex-wrap items-center justify-between gap-3">' +
      '<div><h2 class="text-xl font-semibold text-on-surface">Knowledge entries</h2>' +
      '<p class="mt-1 text-sm text-on-surface-variant">Saved entries are used by the WhatsApp assistant immediately.</p></div>' +
      '<button id="kbAdd" type="button" class="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary">Add entry</button></div>' +
      '<div class="mb-4 flex flex-wrap items-center gap-3"><input id="kbSearch" type="search" placeholder="Search knowledge entries…" class="min-w-[220px] flex-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-secondary"/>' +
      '<span id="kbCount" class="text-xs text-on-surface-variant" aria-live="polite"></span></div>' +
      '<div class="overflow-x-auto rounded-lg bg-surface-container-lowest"><table class="w-full min-w-[700px] text-left text-sm"><thead class="bg-surface-container-high/50 text-xs uppercase text-on-surface-variant"><tr>' +
      '<th class="p-3">Category</th><th class="p-3">Title</th><th class="p-3">Knowledge</th><th class="p-3">Status</th><th class="p-3">Updated</th><th class="p-3 text-right">Actions</th>' +
      '</tr></thead><tbody id="kbRows" class="divide-y divide-surface-container-high/40"></tbody></table></div>' +
      '<p id="kbEmpty" class="hidden py-10 text-center text-sm text-on-surface-variant"></p>';

    const test = el('section', 'rounded-xl bg-surface-container-low p-5 shadow-sm');
    test.innerHTML =
      '<div class="mb-3 flex items-center justify-between"><h3 class="font-semibold text-on-surface">Test retrieval</h3>' +
      '<span class="rounded-full bg-surface-container-highest px-2 py-1 text-xs text-on-surface-variant">Live</span></div>' +
      '<p class="mb-4 text-sm text-on-surface-variant">Ask a question to test the current enabled Supabase entries.</p>' +
      '<form id="kbTestForm" class="space-y-3"><textarea id="kbTestQuery" required maxlength="2000" rows="3" placeholder="Ask a guest question…" class="w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 text-sm outline-none focus:border-secondary"></textarea>' +
      '<button class="w-full rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary" type="submit">Ask the assistant</button></form>' +
      '<div id="kbTestResult" class="mt-4 space-y-3 text-sm" aria-live="polite"></div>';

    grid.append(categories, main, test);
    $('#kbAdd', main).addEventListener('click', () => editEntry());
    $('#kbSearch', main).addEventListener('input', (event) => {
      state.query = event.target.value.trim().toLocaleLowerCase();
      renderRows();
    });
    $('#kbTestForm', test).addEventListener('submit', testQuestion);
    createEditor();
    return { categories, main };
  }

  function createEditor() {
    const dialog = el('dialog', 'w-[min(640px,calc(100%-2rem))] rounded-2xl bg-surface p-0 shadow-2xl backdrop:bg-black/40');
    dialog.innerHTML =
      '<form id="kbEditorForm" class="space-y-4 p-6">' +
      '<div class="flex items-start justify-between gap-3"><div><h2 id="kbEditorTitle" class="text-xl font-bold text-on-surface">Add knowledge entry</h2><p class="mt-1 text-sm text-on-surface-variant">Use approved, factual details only.</p></div>' +
      '<button type="button" id="kbEditorClose" class="rounded-lg px-3 py-1 text-on-surface-variant" aria-label="Close">✕</button></div>' +
      '<label class="block text-sm font-medium text-on-surface">Category<input name="category" required maxlength="80" class="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2"/></label>' +
      '<label class="block text-sm font-medium text-on-surface">Title<input name="title" required maxlength="160" class="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2"/></label>' +
      '<label class="block text-sm font-medium text-on-surface">Answer / details<textarea name="content" required maxlength="5000" rows="6" class="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2"></textarea></label>' +
      '<label class="flex items-center gap-2 text-sm text-on-surface"><input name="enabled" type="checkbox" checked/> Enabled for assistant retrieval</label>' +
      '<p id="kbEditorError" class="text-sm text-error" role="alert"></p>' +
      '<div class="flex justify-end gap-2"><button type="button" id="kbEditorCancel" class="rounded-lg border border-outline-variant px-4 py-2 text-sm">Cancel</button>' +
      '<button type="submit" class="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary">Save entry</button></div></form>';
    document.body.append(dialog);
    $('#kbEditorClose', dialog).addEventListener('click', () => dialog.close());
    $('#kbEditorCancel', dialog).addEventListener('click', () => dialog.close());
    $('#kbEditorForm', dialog).addEventListener('submit', saveEntry);
  }

  function setStatus(message, error = false) {
    const status = $('.kb-sync-status');
    if (status) {
      status.textContent = message;
      status.classList.toggle('text-error', error);
    }
  }

  async function loadItems() {
    setStatus('Syncing…');
    const data = await request();
    state.items = Array.isArray(data.items) ? data.items : [];
    setStatus('Synced just now');
    renderCategories();
    renderRows();
  }

  function filteredItems() {
    return state.items.filter((item) => {
      const byCategory = state.category === 'All items' || item.category === state.category;
      const searchable = `${item.category} ${item.title} ${item.content}`.toLocaleLowerCase();
      return byCategory && (!state.query || searchable.includes(state.query));
    });
  }

  function renderCategories() {
    const box = $('#kbCategories');
    box.replaceChildren(el('h3', 'mb-3 px-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant', 'Categories'));
    const categories = ['All items', ...new Set(state.items.map((item) => item.category).sort((a, b) => a.localeCompare(b)))];
    for (const category of categories) {
      const count = category === 'All items'
        ? state.items.length
        : state.items.filter((item) => item.category === category).length;
      const button = makeButton(`${category} (${count})`, `${buttonClass} mb-1 flex w-full items-center justify-between text-left ${state.category === category ? 'bg-secondary text-on-secondary' : 'text-on-surface-variant hover:bg-surface-container-high'}`, () => {
        state.category = category;
        renderCategories();
        renderRows();
      });
      box.append(button);
    }
  }

  function renderRows() {
    const body = $('#kbRows');
    const empty = $('#kbEmpty');
    body.replaceChildren();
    const rows = filteredItems();
    $('#kbCount').textContent = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`;
    empty.classList.toggle('hidden', rows.length > 0);
    if (!rows.length) {
      empty.textContent = state.items.length ? 'No entries match this filter.' : 'No knowledge entries yet. Add approved facts to make the assistant useful.';
      return;
    }

    for (const item of rows) {
      const row = el('tr', 'align-top hover:bg-surface-container-low/50');
      const category = el('td', 'p-3 font-medium', item.category);
      const title = el('td', 'p-3 font-semibold', item.title);
      const content = el('td', 'max-w-[360px] whitespace-pre-wrap p-3 text-on-surface-variant', item.content);
      const enabled = el('td', 'p-3', item.enabled ? 'Enabled' : 'Disabled');
      enabled.classList.add(item.enabled ? 'text-emerald-700' : 'text-on-surface-variant');
      const updated = el('td', 'p-3 text-xs text-on-surface-variant', item.updated_at ? new Date(item.updated_at).toLocaleString() : '—');
      const actions = el('td', 'p-3 text-right whitespace-nowrap');
      actions.append(
        makeButton('Edit', 'mr-2 rounded-md border border-outline-variant px-2 py-1 text-xs', () => editEntry(item)),
        makeButton('Delete', 'rounded-md border border-error/30 px-2 py-1 text-xs text-error', () => deleteEntry(item))
      );
      row.append(category, title, content, enabled, updated, actions);
      body.append(row);
    }
  }

  function editEntry(item = null) {
    const dialog = $('dialog');
    const form = $('#kbEditorForm', dialog);
    form.dataset.itemId = item ? item.id : '';
    $('#kbEditorTitle', dialog).textContent = item ? 'Edit knowledge entry' : 'Add knowledge entry';
    $('#kbEditorError', dialog).textContent = '';
    form.elements.category.value = item ? item.category : '';
    form.elements.title.value = item ? item.title : '';
    form.elements.content.value = item ? item.content : '';
    form.elements.enabled.checked = item ? item.enabled : true;
    dialog.showModal();
  }

  async function saveEntry(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = form.dataset.itemId;
    const payload = {
      category: form.elements.category.value,
      title: form.elements.title.value,
      content: form.elements.content.value,
      enabled: form.elements.enabled.checked,
    };
    try {
      await request(id ? `/${encodeURIComponent(id)}` : '', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      form.closest('dialog').close();
      await loadItems();
    } catch (error) {
      $('#kbEditorError').textContent = error.message;
    }
  }

  async function deleteEntry(item) {
    if (!window.confirm(`Delete "${item.title}" from the knowledge base?`)) return;
    try {
      await request('/' + encodeURIComponent(item.id), { method: 'DELETE' });
      await loadItems();
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function testQuestion(event) {
    event.preventDefault();
    const query = $('#kbTestQuery').value.trim();
    if (!query) return;
    const resultBox = $('#kbTestResult');
    resultBox.replaceChildren(el('p', 'text-on-surface-variant', 'Checking current knowledge…'));
    try {
      const result = await request('/test', { method: 'POST', body: JSON.stringify({ query }) });
      resultBox.replaceChildren(el('p', 'rounded-lg bg-surface-container-lowest p-3 text-on-surface', result.answer));
      if (result.sources && result.sources.length) {
        resultBox.append(el('p', 'text-xs font-semibold text-on-surface-variant', 'Sources:'));
        for (const source of result.sources) {
          resultBox.append(el('span', 'mr-1 inline-block rounded-md bg-[#c4e7ff] px-2 py-1 text-xs text-[#001e2c]', `${source.category}: ${source.title}`));
        }
      }
    } catch (error) {
      resultBox.replaceChildren(el('p', 'text-error', error.message));
    }
  }

  function init() {
    const grid = $('.grid.grid-cols-12');
    if (!grid) return;
    const banner = $('.mb-gutter.bg-surface-container-high');
    if (banner) {
      const title = $('p.font-headline-sm', banner);
      if (title) title.textContent = 'Knowledge base sync';
      const label = $('.font-label-sm', banner);
      if (label) {
        label.classList.add('kb-sync-status');
        label.textContent = 'Connecting to Supabase…';
      }
      const sync = $('button', banner);
      if (sync) sync.addEventListener('click', () => loadItems().catch((error) => setStatus(error.message, true)));
      const detail = $('p.font-body-sm', banner);
      if (detail) detail.textContent = 'Enabled entries are loaded from Supabase and used for WhatsApp answers.';
    }
    buildLayout(grid);
    loadItems().catch((error) => setStatus(error.message, true));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
