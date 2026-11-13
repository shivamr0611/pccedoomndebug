const test = require('node:test');
const assert = require('node:assert/strict');
const { answerFromKnowledge, retrieveKnowledge } = require('./knowledge_base');
const { createSupabaseStore } = require('./conversation_service');

const items = [
  { id: '1', category: 'Rooms', title: 'Executive Suite', content: 'Peak rate ₹22,000 per night; maximum 3 adults.', enabled: true },
  { id: '2', category: 'Policies', title: 'Check-out time', content: 'Check-out is at 11 AM.', enabled: true },
  { id: '3', category: 'Rooms', title: 'Hidden villa', content: 'This entry is disabled.', enabled: false },
];

test('knowledge retrieval ranks matching current entries and ignores disabled entries', () => {
  assert.deepEqual(retrieveKnowledge(items, 'What is the peak rate for Executive Suite?').map((item) => item.id), ['1']);
  assert.deepEqual(retrieveKnowledge(items, 'What time is check-out?').map((item) => item.id), ['2']);
  assert.deepEqual(retrieveKnowledge(items, 'Does the hidden villa have a pool?'), []);
});

test('knowledge answers use retrieved entries as context and return their sources', async () => {
  let request;
  const result = await answerFromKnowledge(
    'What is the peak rate for Executive Suite?',
    items,
    'test-key',
    async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'The peak rate is ₹22,000 per night.' } }] }),
      };
    }
  );

  assert.equal(request.body.model, 'qwen/qwen3.8-27b');
  assert.match(request.body.messages[1].content, /Peak rate ₹22,000 per night/);
  assert.equal(result.answer, 'The peak rate is ₹22,000 per night.');
  assert.deepEqual(result.sources.map((item) => item.id), ['1']);
});

test('no matching knowledge entry does not call the model', async () => {
  let called = false;
  const result = await answerFromKnowledge('What is the airport transfer price?', items, 'test-key', async () => {
    called = true;
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test('translated query can retrieve an English entry while the original question stays in context', async () => {
  const breakfast = { id: '4', category: 'Dining', title: 'Breakfast hours', content: 'Breakfast is served from 7 to 10 AM.', enabled: true };
  let prompt;
  const result = await answerFromKnowledge(
    'नाश्ता कितने बजे मिलता है?',
    [...items, breakfast],
    'test-key',
    async (_url, options) => {
      prompt = JSON.parse(options.body).messages[1].content;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Breakfast is served from 7 to 10 AM.' } }] }) };
    },
    'What time is breakfast served?'
  );
  assert.deepEqual(result.sources.map((item) => item.id), ['4']);
  assert.match(prompt, /नाश्ता कितने बजे मिलता है/);
});

test('Supabase knowledge store lists, creates, edits, and deletes entries', async () => {
  const calls = [];
  const item = { id: 'item-1', category: 'Rooms', title: 'Suite', content: 'Rate details', enabled: true };
  const store = createSupabaseStore({
    url: 'https://example.supabase.co',
    serviceRoleKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      const method = options.method;
      const body = method === 'POST'
        ? [{ ...item }]
        : method === 'PATCH'
          ? [{ ...item, title: 'Updated suite' }]
          : method === 'DELETE'
            ? [{ id: item.id }]
            : [item];
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    },
  });

  assert.deepEqual(await store.listKnowledgeBaseItems(), [item]);
  assert.deepEqual(await store.insertKnowledgeBaseItem(item), item);
  assert.equal((await store.updateKnowledgeBaseItem(item.id, { title: 'Updated suite' })).title, 'Updated suite');
  assert.equal(await store.deleteKnowledgeBaseItem(item.id), true);
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /knowledge_base_items\?select=\*&order=category\.asc,title\.asc/);
  assert.equal(calls[1].options.headers.apikey, 'test-key');
});
