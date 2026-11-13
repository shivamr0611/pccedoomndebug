// End-to-end check against the real Supabase project, using a throwaway guest that is deleted afterwards.
// Run: node test-live-flow.js
process.loadEnvFile(__dirname + '/.env');
const { createConversationService, createSupabaseStore } = require('./conversation_service');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: key, Authorization: 'Bearer ' + key };
const PHONE = '+910000000001'; // test number, not a real guest

(async () => {
  const store = createSupabaseStore({ url, serviceRoleKey: key });
  const svc = createConversationService({
    store,
    aiReply: async (t) => 'AI reply to: ' + t,
    summarize: async (ms) => 'TEST SUMMARY of ' + ms.length + ' messages',
  });
  const say = async (text, id) => console.log(JSON.stringify(text), '->', JSON.stringify(await svc.handleIncomingMessage(PHONE, text, id)));

  try {
    await say('hello', 'live-1');
    await say('is breakfast included?', 'live-2');
    await say('is breakfast included?', 'live-2'); // retried delivery -> null
    console.log('staff saved:', await svc.saveStaffMessage(PHONE, 'Yes, 7-10 AM'));
    const closeReply = await svc.handleIncomingMessage(PHONE, '/close');
    console.log('/close ->', JSON.stringify(closeReply));
    const guest = await store.findGuest(PHONE);
    const { conversations } = await store.dashboardConversations();
    const closed = conversations.find((c) => c.guest_id === guest.id && c.status === 'closed');
    const detail = await store.dashboardConversation(closed.id);
    console.log('admin summary:', detail.summary);
    console.log('stored messages:', JSON.stringify(detail.messages.map(({ sender, body }) => ({ sender, body }))));
    await say('next conversation message', 'live-3');
  } finally {
    const r = await fetch(url + '/rest/v1/guests?phone=eq.' + encodeURIComponent(PHONE), { method: 'DELETE', headers: H });
    console.log('cleanup (guest + cascade) status:', r.status);
  }
})().catch((e) => console.error('FAILED:', e.message, e.code || ''));
