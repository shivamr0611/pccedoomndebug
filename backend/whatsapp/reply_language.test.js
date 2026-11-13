const test = require('node:test');
const assert = require('node:assert/strict');
const { translateReplyToLanguage } = require('./reply_language');

test('voice replies are translated into the detected language before delivery', async () => {
  let request;
  let callCount = 0;
  const translated = await translateReplyToLanguage(
    'Your room is ready.',
    'Hindi',
    'test-key',
    async (url, options) => {
      callCount++;
      request = { url, ...JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: callCount === 1 ? 'Your room is ready.' : 'आपका कमरा तैयार है।',
            },
          }],
        }),
      };
    }
  );

  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(request.model, 'qwen/qwen3.8-27b');
  assert.match(request.messages[0].content, /into Hindi/);
  assert.equal(JSON.parse(request.messages[1].content).reply, 'Your room is ready.');
  assert.equal(translated, 'आपका कमरा तैयार है।');
  assert.equal(callCount, 2);
});

test('unknown language hints preserve the existing reply without a translation request', async () => {
  const text = 'Reply in the detected language.';
  assert.equal(await translateReplyToLanguage(text, 'Unknown', 'test-key', async () => {
    throw new Error('should not call translator');
  }), text);
});

test('English-only output is rejected for a Hindi voice reply', async () => {
  let callCount = 0;
  await assert.rejects(
    translateReplyToLanguage(
      'Your room is ready.',
      'Hindi',
      'test-key',
      async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'Your room is ready.' } }] }),
        };
      }
    ),
    /without the Hindi script/
  );
  assert.equal(callCount, 2);
});
