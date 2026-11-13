// Session-based conversation logging: conversations start on the first message; /close ends one.
// Everything between the two is stored in Supabase. See supabase/migrations/ for the schema.

const crypto = require('crypto');

const REPLIES = {
  started: 'New conversation started. How can I help you?',
  alreadyOpen: 'You already have an open conversation. Type /close to end it first.',
  closed: 'Conversation closed. A new conversation is ready.',
  noneOpen: 'There is no open conversation to close.',
};

const UNIQUE_VIOLATION = '23505';

/** Normalizes a phone number or WhatsApp id (e.g. 919876543210@c.us) to E.164: +919876543210. */
function normalizePhone(raw, defaultCountryCode = '91') {
  let digits = String(raw || '').split('@')[0].replace(/\D/g, '');
  if (digits.length === 10) digits = defaultCountryCode + digits;
  if (digits.length < 8 || digits.length > 15) throw new Error('Invalid phone number: ' + raw);
  return '+' + digits;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Short conversation id shown to guests: two letters then two digits, e.g. "ab12". */
const CODE_RE = /^[a-z]{2}[0-9]{2}$/i;

function generateCode() {
  const letter = () => String.fromCharCode(97 + crypto.randomInt(26));
  return letter() + letter() + String(crypto.randomInt(100)).padStart(2, '0');
}

/** Returns 'new' or 'close' only for an exact (case-insensitive, trimmed) command, else null. */
function parseCommand(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t === '/new') return 'new';
  if (t === '/close') return 'close';
  return null;
}

/**
 * @param {object} deps
 * @param {object} deps.store      data access, see createSupabaseStore / the in-memory store in the tests
 * @param {(text: string, history: {sender: string, body: string}[]) => Promise<string>} deps.aiReply
 *        the existing AI reply pipeline
 * @param {(messages: {sender: string, body: string}[]) => Promise<string>} deps.summarize
 *        builds an admin-only summary when a conversation is closed
 */
function createConversationService({ store, aiReply, summarize, logger = console }) {
  /** Finds or creates the guest. A WhatsApp display name fills in a missing name but never overwrites one. */
  async function getOrCreateGuest(phone, name = null) {
    let guest = await store.findGuest(phone);
    if (!guest) {
      try {
        return await store.insertGuest(phone, name);
      } catch (e) {
        if (e.code !== UNIQUE_VIOLATION) throw e;
        guest = await store.findGuest(phone); // created by a concurrent request
      }
    }
    if (name && !guest.name) {
      try {
        await store.updateGuestName(guest.id, name);
        guest = { ...guest, name };
      } catch (e) {
        logger.error('Saving guest name failed:', e.message); // not fatal
      }
    }
    return guest;
  }

  const getOpenConversation = (guestId) => store.findOpenConversation(guestId);

  /** Returns { conversation, created }. The partial unique index guarantees a single open row. */
  async function startConversation(guestId) {
    const open = await getOpenConversation(guestId);
    if (open) return { conversation: open, created: false };
    // A unique violation is either "guest already has an open conversation" (concurrent start)
    // or a short-code collision; only the second needs a retry with a new code.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        return { conversation: await store.insertConversation(guestId, generateCode()), created: true };
      } catch (e) {
        if (e.code !== UNIQUE_VIOLATION) throw e;
        const nowOpen = await getOpenConversation(guestId);
        if (nowOpen) return { conversation: nowOpen, created: false };
      }
    }
    throw new Error('Could not generate a unique conversation code');
  }

  /** Returns the closed conversation, or null if the guest had none open. */
  const closeConversation = (guestId) => store.closeOpenConversation(guestId);

  /** Generates and stores a summary for the admin dashboard without exposing it in WhatsApp. */
  async function saveAdminSummary(conversation) {
    if (!summarize || conversation.summary) return;
    try {
      const messages = (await store.listMessages(conversation.id)).filter(
        (message) => !(message.sender === 'guest' && /^\/close$/i.test(message.body.trim()))
      );
      if (!messages.length) return;
      const summary = await summarize(messages);
      await store.setSummary(conversation.id, summary);
    } catch (e) {
      logger.error('Conversation summary failed:', e.message);
    }
  }

  /** Returns the saved row, or null when provider_message_id was already stored (duplicate delivery). */
  async function saveMessage(conversationId, sender, body, providerMessageId = null) {
    try {
      return await store.insertMessage({
        conversation_id: conversationId,
        sender,
        body,
        provider_message_id: providerMessageId,
      });
    } catch (e) {
      if (e.code === UNIQUE_VIOLATION && providerMessageId) return null;
      throw e;
    }
  }

  /**
   * Main entry point. Returns the text to send back to the guest,
   * or null when nothing should be sent (empty text, or a retried message that was already handled).
   */
  async function handleIncomingMessage(phone, text, providerMessageId = null, profile = {}, replyOverride = null) {
    if (!String(text || '').trim()) return null;
    try {
      const guest = await getOrCreateGuest(normalizePhone(phone), profile.name || null);
      const command = parseCommand(text);
      if (command === 'new') {
        logger.log('[conversation] /new from ' + guest.phone);
        const { created } = await startConversation(guest.id);
        return created ? REPLIES.started : REPLIES.alreadyOpen;
      }
      if (command === 'close') {
        logger.log('[conversation] /close from ' + guest.phone);
        const active = await getOpenConversation(guest.id);
        if (!active) return REPLIES.noneOpen;
        const saved = await saveMessage(active.id, 'guest', text, providerMessageId);
        if (!saved) {
          logger.log('[conversation] duplicate message ' + providerMessageId + ' ignored');
          return null;
        }
        const closed = await store.closeConversationById(active.id);
        if (!closed) return REPLIES.noneOpen;
        await startConversation(guest.id);
        await saveAdminSummary(closed);
        return REPLIES.closed;
      }

      const conversation = (await getOpenConversation(guest.id)) || (await startConversation(guest.id)).conversation;

      const history = store.listRecentMessages
        ? await store.listRecentMessages(conversation.id, 12)
        : (await store.listMessages(conversation.id)).slice(-12);
      const saved = await saveMessage(conversation.id, 'guest', text, providerMessageId);
      if (!saved) {
        logger.log('[conversation] duplicate message ' + providerMessageId + ' ignored');
        return null;
      }

      let reply;
      try {
        reply = replyOverride === null
          ? await aiReply(text, history.map(({ sender, body }) => ({ sender, body })))
          : replyOverride;
      } catch (e) {
        logger.error('AI reply failed:', e.message);
        return null;
      }
      await saveMessage(conversation.id, 'ai', reply);
      return reply;
    } catch (e) {
      logger.error('Conversation service error:', e.message);
      return null;
    }
  }

  /** Saves a message typed by staff (admin dashboard) into the guest's open conversation, if any. */
  async function saveStaffMessage(phone, body) {
    try {
      const guest = await store.findGuest(normalizePhone(phone));
      const conversation = guest && (await getOpenConversation(guest.id));
      if (!conversation) return false;
      await saveMessage(conversation.id, 'staff', body);
      return true;
    } catch (e) {
      logger.error('Saving staff message failed:', e.message);
      return false;
    }
  }

  /**
   * Optional extra, NOT wired up anywhere: closes conversations with no activity for `hours`.
   * Call it from a timer or cron when you want it. Returns the number of conversations closed.
   */
  async function closeStaleConversations(hours = 24, now = new Date()) {
    const cutoff = now.getTime() - hours * 3600 * 1000;
    let closedCount = 0;
    for (const conversation of await store.listOpenConversations()) {
      const lastActivity = (await store.lastMessageAt(conversation.id)) || conversation.started_at;
      if (new Date(lastActivity).getTime() < cutoff) {
        if (await store.closeConversationById(conversation.id)) closedCount++;
      }
    }
    return closedCount;
  }

  return {
    handleIncomingMessage,
    saveStaffMessage,
    startConversation,
    closeConversation,
    getOpenConversation,
    saveMessage,
    closeStaleConversations,
  };
}

/** Supabase (PostgREST) data access using the service role key. Server-side only. */
function createSupabaseStore({ url, serviceRoleKey, fetchImpl = fetch }) {
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  const base = url.replace(/\/$/, '') + '/rest/v1/';

  async function rest(method, pathAndQuery, body, prefer = 'return=representation') {
    const res = await fetchImpl(base + pathAndQuery, {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: 'Bearer ' + serviceRoleKey,
        'Content-Type': 'application/json',
        Prefer: prefer,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!res.ok) {
      const err = new Error((data && data.message) || 'Supabase HTTP ' + res.status);
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  const q = encodeURIComponent;
  const first = (rows) => (rows && rows.length ? rows[0] : null);

  /** Reads every row of a query (PostgREST returns at most 1000 per request). */
  async function fetchAll(pathAndQuery) {
    const all = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await rest('GET', pathAndQuery + '&limit=1000&offset=' + offset);
      all.push(...page);
      if (page.length < 1000) return all;
    }
  }

  // 42703 / PGRST204: the optional short-code column has not been added to the database yet.
  const missingCodeColumn = (e) => (e.code === '42703' || e.code === 'PGRST204') && /\bcode\b/.test(e.message);

  return {
    findGuest: async (phone) => first(await rest('GET', 'guests?select=*&limit=1&phone=eq.' + q(phone))),
    insertGuest: async (phone, name = null) => first(await rest('POST', 'guests', { phone, name })),
    updateGuestName: (id, name) => rest('PATCH', 'guests?id=eq.' + q(id), { name }),
    findOpenConversation: async (guestId) =>
      first(await rest('GET', 'conversations?select=*&limit=1&status=eq.open&guest_id=eq.' + q(guestId))),
    insertConversation: async (guestId, code) => {
      try {
        return first(await rest('POST', 'conversations', { guest_id: guestId, code }));
      } catch (e) {
        if (!missingCodeColumn(e)) throw e;
        console.warn('conversations.code column is missing: run supabase/migrations/20261113010000_conversation_short_code.sql');
        return first(await rest('POST', 'conversations', { guest_id: guestId }));
      }
    },
    findConversationByCode: async (code) => {
      try {
        return first(await rest('GET', 'conversations?select=*&limit=1&code=eq.' + q(code)));
      } catch (e) {
        if (missingCodeColumn(e)) return null;
        throw e;
      }
    },
    closeOpenConversation: async (guestId) =>
      first(
        await rest('PATCH', 'conversations?status=eq.open&guest_id=eq.' + q(guestId), {
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
      ),
    closeConversationById: async (id) =>
      first(
        await rest('PATCH', 'conversations?status=eq.open&id=eq.' + q(id), {
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
      ),
    // Read models for the dashboard: conversations joined with their guest, newest activity first.
    // Everything stored in Supabase: all guests (even without conversations), all conversations, all messages.
    dashboardConversations: async () => {
      const [guests, convs, msgs] = await Promise.all([
        fetchAll('guests?select=*&order=created_at.desc,id.asc'),
        fetchAll('conversations?select=*,guests(*)&order=started_at.desc,id.asc'),
        fetchAll('messages?select=id,conversation_id,sender,body,created_at&order=created_at.desc,id.desc'),
      ]);
      const last = new Map();
      const lastGuest = new Map();
      const count = new Map();
      for (const m of msgs) {
        if (!last.has(m.conversation_id)) last.set(m.conversation_id, m); // rows arrive newest first
        if (m.sender === 'guest' && !lastGuest.has(m.conversation_id)) lastGuest.set(m.conversation_id, m);
        count.set(m.conversation_id, (count.get(m.conversation_id) || 0) + 1);
      }
      const conversations = convs
        .map((c) => {
          const lm = last.get(c.id) || null;
          return {
            ...c,
            last_message: lm,
            last_guest_message: lastGuest.get(c.id) || null,
            message_count: count.get(c.id) || 0,
            last_activity: lm ? lm.created_at : c.started_at,
          };
        })
        .sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
      return { conversations, guests };
    },
    dashboardConversation: async (id) => {
      const conv = first(
        await rest(
          'GET',
          'conversations?select=*,guests(*)&limit=1&id=eq.' + q(id)
        )
      );
      if (!conv) return null;
      const messages = await fetchAll('messages?select=*&order=created_at.asc,id.asc&conversation_id=eq.' + q(conv.id));
      return { ...conv, messages };
    },
    guestHasConversations: async (guestId) =>
      (await rest('GET', 'conversations?select=id&guest_id=eq.' + q(guestId) + '&limit=1')).length > 0,
    deleteGuest: async (guestId) =>
      (await rest('DELETE', 'guests?id=eq.' + q(guestId))).length > 0,
    deleteConversation: async (id) =>
      (await rest('DELETE', 'conversations?id=eq.' + q(id))).length > 0,
    findConversationById: async (id) => first(await rest('GET', 'conversations?select=*&limit=1&id=eq.' + q(id))),
    setSummary: (id, summary) => rest('PATCH', 'conversations?id=eq.' + q(id), { summary }),
    insertMessage: async (row) => first(await rest('POST', 'messages', row)),
    listKnowledgeBaseItems: () =>
      fetchAll('knowledge_base_items?select=*&order=category.asc,title.asc'),
    insertKnowledgeBaseItem: async (item) =>
      first(await rest('POST', 'knowledge_base_items', item)),
    updateKnowledgeBaseItem: async (id, item) =>
      first(
        await rest('PATCH', 'knowledge_base_items?id=eq.' + q(id), {
          ...item,
          updated_at: new Date().toISOString(),
        })
      ),
    deleteKnowledgeBaseItem: async (id) =>
      (await rest('DELETE', 'knowledge_base_items?id=eq.' + q(id))).length > 0,
    listMessages: (conversationId) =>
      rest('GET', 'messages?select=sender,body,created_at&order=created_at.asc&conversation_id=eq.' + q(conversationId)),
    listRecentMessages: async (conversationId, limit = 12) => {
      const rows = await rest(
        'GET',
        'messages?select=sender,body,created_at&order=created_at.desc,id.desc&limit=' +
          Math.max(1, Math.min(20, Math.trunc(Number(limit)) || 12)) +
          '&conversation_id=eq.' + q(conversationId)
      );
      return rows.reverse();
    },
    listRoomBookings: (startDate, endDate) =>
      rest(
        'GET',
        'room_bookings?select=booking_date,room_number&and=(booking_date.gte.' +
          q(startDate) + ',booking_date.lt.' + q(endDate) + ')' +
          '&order=booking_date.asc,room_number.asc'
      ),
    setRoomBooking: async (bookingDate, roomNumber, occupied) => {
      const filter =
        'booking_date=eq.' + q(bookingDate) + '&room_number=eq.' + q(roomNumber);
      if (!occupied) return (await rest('DELETE', 'room_bookings?' + filter)).length > 0;
      return first(
        await rest(
          'POST',
          'room_bookings?on_conflict=booking_date,room_number',
          { booking_date: bookingDate, room_number: roomNumber },
          'resolution=merge-duplicates,return=representation'
        )
      );
    },
    listOpenConversations: () => rest('GET', 'conversations?select=*&status=eq.open'),
    lastMessageAt: async (conversationId) => {
      const row = first(
        await rest('GET', 'messages?select=created_at&order=created_at.desc&limit=1&conversation_id=eq.' + q(conversationId))
      );
      return row && row.created_at;
    },
  };
}

module.exports = {
  UUID_RE,
  CODE_RE,
  createConversationService,
  createSupabaseStore,
  normalizePhone,
  parseCommand,
  REPLIES,
};
