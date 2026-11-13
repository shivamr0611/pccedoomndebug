// Run: node --test conversation_service.test.js
const test = require('node:test');
const assert = require('node:assert');
const {
  createConversationService,
  createSupabaseStore,
  normalizePhone,
  parseCommand,
  CODE_RE,
  REPLIES,
} = require('./conversation_service');

const uniq = () => Object.assign(new Error('duplicate key'), { code: '23505' });

// In-memory store that enforces the same unique rules as the database.
function memoryStore() {
  const s = { guests: [], conversations: [], messages: [], n: 0 };
  const id = () => 'id' + ++s.n;
  return {
    s,
    findGuest: async (phone) => s.guests.find((g) => g.phone === phone) || null,
    insertGuest: async (phone, name = null) => {
      if (s.guests.some((g) => g.phone === phone)) throw uniq();
      const g = { id: id(), phone, name };
      s.guests.push(g);
      return g;
    },
    updateGuestName: async (gid, name) => (s.guests.find((g) => g.id === gid).name = name),
    findOpenConversation: async (gid) => s.conversations.find((c) => c.guest_id === gid && c.status === 'open') || null,
    insertConversation: async (gid, code) => {
      if (s.conversations.some((c) => c.guest_id === gid && c.status === 'open')) throw uniq();
      if (s.conversations.some((c) => c.code === code)) throw uniq();
      const c = { id: id(), code, guest_id: gid, status: 'open', started_at: new Date().toISOString(), closed_at: null, summary: null };
      s.conversations.push(c);
      return c;
    },
    closeOpenConversation: async (gid) => {
      const c = s.conversations.find((x) => x.guest_id === gid && x.status === 'open');
      if (!c) return null;
      c.status = 'closed';
      c.closed_at = new Date().toISOString();
      return c;
    },
    closeConversationById: async (cid) => {
      const c = s.conversations.find((x) => x.id === cid && x.status === 'open');
      if (!c) return null;
      c.status = 'closed';
      c.closed_at = new Date().toISOString();
      return c;
    },
    findConversationByCode: async (code) => s.conversations.find((c) => c.code === code) || null,
    findConversationById: async (cid) => s.conversations.find((c) => c.id === cid) || null,
    setSummary: async (cid, summary) => (s.conversations.find((c) => c.id === cid).summary = summary),
    insertMessage: async (row) => {
      if (row.provider_message_id && s.messages.some((m) => m.provider_message_id === row.provider_message_id)) throw uniq();
      const m = { id: id(), created_at: new Date().toISOString(), ...row };
      s.messages.push(m);
      return m;
    },
    listMessages: async (cid) => s.messages.filter((m) => m.conversation_id === cid),
    listRecentMessages: async (cid, limit = 12) =>
      s.messages.filter((m) => m.conversation_id === cid).slice(-limit),
    listOpenConversations: async () => s.conversations.filter((c) => c.status === 'open'),
    lastMessageAt: async (cid) => {
      const ms = s.messages.filter((m) => m.conversation_id === cid);
      return ms.length ? ms[ms.length - 1].created_at : null;
    },
  };
}

const quiet = { log() {}, error() {} };
function setup(extra = {}) {
  const store = memoryStore();
  const svc = createConversationService({ store, aiReply: async (t) => 'AI:' + t, logger: quiet, ...extra });
  return { store, svc, phone: '919876543210@c.us' };
}

test('normalizePhone and parseCommand', () => {
  assert.equal(normalizePhone('919876543210@c.us'), '+919876543210');
  assert.equal(normalizePhone('9876543210'), '+919876543210');
  assert.equal(normalizePhone('+91 98765 43210'), '+919876543210');
  assert.equal(parseCommand(' /NEW '), 'new');
  assert.equal(parseCommand('/Close'), 'close');
  assert.equal(parseCommand('what does /new mean'), null);
  assert.equal(parseCommand('/new please'), null);
});

test('a guest message automatically starts a conversation', async () => {
  const { svc, store, phone } = setup();
  assert.equal(await svc.handleIncomingMessage(phone, 'hello', 'm1'), 'AI:hello');
  assert.equal(store.s.conversations.length, 1);
  assert.equal(store.s.conversations[0].status, 'open');
  assert.deepEqual(store.s.messages.map((m) => m.sender), ['guest', 'ai']);
});

test('AI reply receives prior conversation messages without the current guest message', async () => {
  let received;
  const { store, svc, phone } = setup({
    aiReply: async (text, history) => {
      received = { text, history };
      return 'AI:' + text;
    },
  });

  await svc.handleIncomingMessage(phone, 'What time is breakfast?', 'm1');
  await svc.handleIncomingMessage(phone, 'and checkout?', 'm2');

  assert.equal(received.text, 'and checkout?');
  assert.deepEqual(received.history, [
    { sender: 'guest', body: 'What time is breakfast?' },
    { sender: 'ai', body: 'AI:What time is breakfast?' },
  ]);
  assert.equal(store.s.messages.at(-1).body, 'AI:and checkout?');
});

test('a voice transcription is sent through the normal language-aware reply pipeline', async () => {
  let receivedText;
  const { svc, store, phone } = setup({
    aiReply: async (text) => {
      receivedText = text;
      return 'कृपया ताजे तौलिए भेजें।';
    },
  });
  const transcript = 'कृपया ताजे तौलिए भेजें।';
  const reply = await svc.handleIncomingMessage(phone, transcript, 'voice-1');

  assert.equal(receivedText, transcript);
  assert.equal(reply, 'कृपया ताजे तौलिए भेजें।');
  assert.deepEqual(store.s.messages.map((message) => [message.sender, message.body]), [
    ['guest', transcript],
    ['ai', 'कृपया ताजे तौलिए भेजें।'],
  ]);
});

test('/new, messages, /close lifecycle', async () => {
  const { svc, store, phone } = setup();
  assert.equal(await svc.handleIncomingMessage(phone, '/new'), REPLIES.started);
  assert.equal(await svc.handleIncomingMessage(phone, '/new'), REPLIES.alreadyOpen);
  assert.equal(store.s.conversations.length, 1);

  assert.equal(await svc.handleIncomingMessage(phone, 'is breakfast included?', 'm1'), 'AI:is breakfast included?');
  assert.deepEqual(store.s.messages.map((m) => m.sender), ['guest', 'ai']);

  assert.equal(await svc.handleIncomingMessage(phone, ' /CLOSE '), REPLIES.closed);
  assert.equal(store.s.conversations[0].status, 'closed');
  assert.ok(store.s.conversations[0].closed_at);
  assert.equal(store.s.conversations.length, 2);
  assert.equal(store.s.conversations[1].status, 'open');
  assert.equal(await svc.handleIncomingMessage(phone, 'hello again', 'm2'), 'AI:hello again');
  assert.equal(store.s.messages.length, 5);
  assert.equal(await svc.handleIncomingMessage(phone, '/new'), REPLIES.alreadyOpen);
});

test('retried message id creates no duplicate and gets no second reply', async () => {
  const { svc, store, phone } = setup();
  await svc.handleIncomingMessage(phone, '/new');
  assert.equal(await svc.handleIncomingMessage(phone, 'hi', 'dup'), 'AI:hi');
  assert.equal(await svc.handleIncomingMessage(phone, 'hi', 'dup'), null);
  assert.equal(store.s.messages.filter((m) => m.sender === 'guest').length, 1);
});

test('a retried /close does not close the newly opened conversation', async () => {
  const { svc, store, phone } = setup();
  await svc.handleIncomingMessage(phone, 'hello', 'm1');
  assert.equal(await svc.handleIncomingMessage(phone, '/close', 'close-1'), REPLIES.closed);
  assert.equal(await svc.handleIncomingMessage(phone, '/close', 'close-1'), null);
  assert.equal(store.s.conversations[0].status, 'closed');
  assert.equal(store.s.conversations[1].status, 'open');
});

test('simultaneous /new creates a single conversation', async () => {
  const { svc, store, phone } = setup();
  const replies = await Promise.all([svc.handleIncomingMessage(phone, '/new'), svc.handleIncomingMessage(phone, '/new')]);
  assert.equal(store.s.conversations.length, 1);
  assert.equal(replies.filter((r) => r === REPLIES.started).length + replies.filter((r) => r === REPLIES.alreadyOpen).length, 2);
});

test('guest name comes from the WhatsApp profile and is not overwritten', async () => {
  const { svc, store, phone } = setup();
  await svc.handleIncomingMessage(phone, '/new', null, { name: 'Rohan Naik' });
  assert.equal(store.s.guests[0].name, 'Rohan Naik');
  await svc.handleIncomingMessage(phone, 'hello', 'n1', { name: 'Someone Else' });
  assert.equal(store.s.guests[0].name, 'Rohan Naik');

  // an existing guest without a name gets one on the next message
  const other = '919444444444@c.us';
  await svc.handleIncomingMessage(other, '/new');
  assert.equal(store.s.guests[1].name, null);
  await svc.handleIncomingMessage(other, 'hello', 'n2', { name: 'Priya' });
  assert.equal(store.s.guests[1].name, 'Priya');
});

test('failing to save the name does not break the reply', async () => {
  const { svc, store, phone } = setup();
  await svc.handleIncomingMessage(phone, '/new');
  store.updateGuestName = async () => { throw new Error('boom'); };
  assert.equal(await svc.handleIncomingMessage(phone, 'hello', 'n3', { name: 'Rohan' }), 'AI:hello');
});

test('guests are separate', async () => {
  const { svc, store } = setup();
  await svc.handleIncomingMessage('919111111111@c.us', 'hello', 'x1');
  await svc.handleIncomingMessage('919222222222@c.us', 'hello', 'x2');
  assert.equal(store.s.guests.length, 2);
  assert.equal(store.s.conversations.length, 2);
});

test('AI failure sends no canned reply but keeps the guest message', async () => {
  const { svc, store, phone } = setup({ aiReply: async () => { throw new Error('groq down'); } });
  await svc.handleIncomingMessage(phone, '/new');
  assert.equal(await svc.handleIncomingMessage(phone, 'hello', 'm1'), null);
  assert.deepEqual(store.s.messages.map((m) => m.sender), ['guest']);
});

test('database failure sends no canned reply', async () => {
  const { svc, store, phone } = setup();
  store.findGuest = async () => { throw new Error('supabase down'); };
  assert.equal(await svc.handleIncomingMessage(phone, '/new'), null);
});

test('Supabase store deletes a conversation by id and reports missing rows', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const calls = [];
  let rows = [{ id }];
  const store = createSupabaseStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    },
  });

  assert.equal(await store.deleteConversation(id), true);
  assert.equal(calls[0].options.method, 'DELETE');
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, '/rest/v1/conversations');
  assert.equal(url.searchParams.get('id'), 'eq.' + id);
  rows = [];
  assert.equal(await store.deleteConversation(id), false);
});

test('Supabase store checks for conversation tickets before deleting a guest', async () => {
  const id = '00000000-0000-4000-8000-000000000002';
  const calls = [];
  let conversationRows = [{ id: 'ticket-1' }];
  const store = createSupabaseStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const rows = options.method === 'DELETE' ? [{ id }] : conversationRows;
      return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    },
  });

  assert.equal(await store.guestHasConversations(id), true);
  const ticketCheckUrl = new URL(calls[0].url);
  assert.equal(ticketCheckUrl.pathname, '/rest/v1/conversations');
  assert.equal(ticketCheckUrl.searchParams.get('guest_id'), 'eq.' + id);
  assert.equal(calls.length, 1);
  conversationRows = [];
  assert.equal(await store.guestHasConversations(id), false);
  assert.equal(await store.deleteGuest(id), true);
  assert.equal(calls[2].options.method, 'DELETE');
  assert.equal(new URL(calls[2].url).pathname, '/rest/v1/guests');
});

test('dashboard conversation list includes the latest guest message for unread tracking', async () => {
  const conversationId = '00000000-0000-4000-8000-000000000003';
  const guestId = '00000000-0000-4000-8000-000000000004';
  const guestMessage = { id: 'guest-message', conversation_id: conversationId, sender: 'guest', body: 'Hello', created_at: '2026-11-13T10:00:00Z' };
  let messageOrder;
  const store = createSupabaseStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const { pathname } = parsedUrl;
      if (pathname.endsWith('/messages')) messageOrder = parsedUrl.searchParams.get('order');
      const rows = pathname.endsWith('/guests')
        ? [{ id: guestId, phone: '+919876543210' }]
        : pathname.endsWith('/conversations')
          ? [{ id: conversationId, guest_id: guestId, status: 'open', started_at: '2026-11-13T09:00:00Z', guests: { id: guestId } }]
          : [
              { id: 'staff-message', conversation_id: conversationId, sender: 'staff', body: 'Hi', created_at: '2026-11-13T10:01:00Z' },
              guestMessage,
            ];
      return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
    },
  });

  const { conversations } = await store.dashboardConversations();
  assert.equal(messageOrder, 'created_at.desc,id.desc');
  assert.equal(conversations[0].last_message.id, 'staff-message');
  assert.equal(conversations[0].last_guest_message.id, guestMessage.id);
});

test('staff message is stored only in an open conversation', async () => {
  const { svc, store, phone } = setup();
  assert.equal(await svc.saveStaffMessage(phone, 'hello from staff'), false);
  await svc.handleIncomingMessage(phone, '/new');
  assert.equal(await svc.saveStaffMessage(phone, 'hello from staff'), true);
  assert.equal(store.s.messages[0].sender, 'staff');
});

test('conversation codes are two letters then two digits', async () => {
  const { svc, store, phone } = setup();
  await svc.handleIncomingMessage(phone, '/new');
  assert.match(store.s.conversations[0].code, /^[a-z]{2}[0-9]{2}$/);
  assert.ok(CODE_RE.test('AB12') && CODE_RE.test('ab12'));
  assert.ok(!CODE_RE.test('a1b2') && !CODE_RE.test('abc12') && !CODE_RE.test('ab1'));
});

test('a code collision is retried with a new code', async () => {
  const { svc, store } = setup();
  // fill the table so most random codes collide: the service must still end up with a unique one
  for (let i = 0; i < 300; i++) {
    store.s.conversations.push({ id: 'x' + i, code: 'zz' + String(i % 100).padStart(2, '0'), guest_id: 'other' + i, status: 'closed' });
  }
  assert.equal(await svc.handleIncomingMessage('919333333333@c.us', '/new'), REPLIES.started);
  const codes = store.s.conversations.map((c) => c.code);
  assert.equal(new Set(codes.filter((c) => !c.startsWith('zz'))).size, 1);
});

test('/close stores an admin summary and opens the next conversation', async () => {
  let calls = 0;
  const { svc, store, phone } = setup({
    summarize: async (ms) => {
      calls++;
      return 'SUMMARY of ' + ms.map((m) => m.sender + ':' + m.body).join(' | ');
    },
  });
  await svc.handleIncomingMessage(phone, 'need a taxi', 'm1');
  const closeReply = await svc.handleIncomingMessage(phone, '/close');
  assert.equal(closeReply, REPLIES.closed);
  const expected = 'SUMMARY of guest:need a taxi | ai:AI:need a taxi';
  assert.equal(calls, 1);
  assert.equal(store.s.conversations[0].summary, expected);
  assert.equal(store.s.conversations[0].status, 'closed');
  assert.equal(store.s.conversations[1].status, 'open');
});

test('/summarise is no longer a command and is never sent as a summary', async () => {
  const { svc, store, phone } = setup();
  assert.equal(await svc.handleIncomingMessage(phone, '/summarise ab12', 'm1'), 'AI:/summarise ab12');
  assert.equal(store.s.conversations[0].summary, null);
});

test('summary failure does not undo closing or starting the next conversation', async () => {
  const { svc, store, phone } = setup({ summarize: async () => { throw new Error('groq down'); } });
  await svc.handleIncomingMessage(phone, 'hello', 'm1');
  assert.equal(await svc.handleIncomingMessage(phone, '/close'), REPLIES.closed);
  assert.equal(store.s.conversations[0].status, 'closed');
  assert.equal(store.s.conversations[0].summary, null);
  assert.equal(store.s.conversations[1].status, 'open');
});

test('closeStaleConversations closes only inactive conversations', async () => {
  const { svc, store, phone } = setup();
  await svc.handleIncomingMessage(phone, '/new');
  assert.equal(await svc.closeStaleConversations(24), 0);
  assert.equal(await svc.closeStaleConversations(24, new Date(Date.now() + 25 * 3600 * 1000)), 1);
  assert.equal(store.s.conversations[0].status, 'closed');
});
