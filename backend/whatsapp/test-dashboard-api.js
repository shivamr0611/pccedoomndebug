// Checks the dashboard read queries against the real Supabase project with throwaway data (deleted afterwards).
// Run: node test-dashboard-api.js
process.loadEnvFile(__dirname + '/.env');
const { createConversationService, createSupabaseStore } = require('./conversation_service');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PHONE = '+910000000002';
const LONELY = '+910000000003'; // a guest with no conversation

(async () => {
  const store = createSupabaseStore({ url, serviceRoleKey: key });
  const svc = createConversationService({ store, aiReply: async (t) => 'AI: ' + t, summarize: async () => 'S' });
  try {
    await svc.handleIncomingMessage(PHONE, '/new');
    await svc.handleIncomingMessage(PHONE, 'नमस्कार, खोली उपलब्ध आहे का?', 'dash-1');
    await svc.saveStaffMessage(PHONE, 'Yes, available');

    await store.insertGuest(LONELY, 'No Tickets');
    const { conversations: list, guests } = await store.dashboardConversations();
    console.log('guests returned:', guests.filter((g) => [PHONE, LONELY].includes(g.phone)).map((g) => g.phone + (g.name ? ' (' + g.name + ')' : '')).join(', '));
    const mine = list.find((c) => c.guests && c.guests.phone === PHONE);
    console.log('list contains test conversation:', !!mine);
    console.log('  status/count/last:', mine.status, mine.message_count, JSON.stringify(mine.last_message.sender + ': ' + mine.last_message.body));

    const detail = await store.dashboardConversation(mine.id);
    console.log('detail messages:', detail.messages.map((m) => m.sender).join(','));
    console.log('detail guest:', JSON.stringify(detail.guests));
    console.log('unknown id ->', await store.dashboardConversation('00000000-0000-4000-8000-000000000000'));
  } finally {
    for (const phone of [PHONE, LONELY]) {
      const r = await fetch(url + '/rest/v1/guests?phone=eq.' + encodeURIComponent(phone), {
        method: 'DELETE',
        headers: { apikey: key, Authorization: 'Bearer ' + key },
      });
      console.log('cleanup', phone, r.status);
    }
  }
})().catch((e) => console.error('FAILED:', e.message, e.code || ''));
