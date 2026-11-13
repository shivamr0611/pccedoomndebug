const test = require('node:test');
const assert = require('node:assert/strict');
const { answerFromKnowledge, retrieveKnowledge } = require('./knowledge_base');

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
