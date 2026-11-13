const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPaymentQr,
  createLocalizedPaymentReply,
  localizePaymentReply,
  paymentIntentPayload,
  extractPaymentAmount,
  isPaymentRelated,
  isThumbsUp,
} = require('./payment_intent');

test('payment intent detection recognizes common English and Indian-language messages', () => {
  assert.equal(isPaymentRelated('Can I make a payment?'), true);
  assert.equal(isPaymentRelated('How much does this cost?'), true);
  assert.equal(isPaymentRelated('मुझे भुगतान करना है'), true);
  assert.equal(isPaymentRelated('मला पैसे भरायचे आहेत'), true);
  assert.equal(isPaymentRelated('₹500'), true);
  assert.equal(isPaymentRelated('500 rupees'), true);
  assert.equal(isPaymentRelated('Can I get extra towels?'), false);
});

test('thumbs-up confirmation accepts plain and skin-tone emoji only', () => {
  assert.equal(isThumbsUp('👍'), true);
  assert.equal(isThumbsUp('👍🏻'), true);
  assert.equal(isThumbsUp('👍️'), true);
  assert.equal(isThumbsUp('yes 👍'), false);
  assert.equal(isThumbsUp('❤️'), false);
});

test('payment amount extraction accepts requested values without mistaking room numbers', () => {
  assert.equal(extractPaymentAmount('Please pay ₹1,234.50'), 1234.5);
  assert.equal(extractPaymentAmount('I want to pay 500 rupees'), 500);
  assert.equal(extractPaymentAmount('५०० रुपये'), 500);
  assert.equal(extractPaymentAmount('Room 204'), null);
  assert.equal(extractPaymentAmount('₹0'), null);
  assert.equal(extractPaymentAmount('500', true), 500);
});

test('UPI QR uses the requested amount and configured payee', async () => {
  const payload = paymentIntentPayload('PAY-AB12', 275.5);
  const parsed = new URL(payload);
  const params = parsed.searchParams;
  assert.equal(parsed.protocol, 'upi:');
  assert.equal(parsed.hostname, 'pay');
  assert.equal(params.get('pa'), 'shivamsrevankar@oksbi');
  assert.equal(params.get('am'), '275.50');
  assert.equal(params.get('cu'), 'INR');
  assert.equal(params.get('tr'), 'PAY-AB12');

  const qr = await createPaymentQr('PAY-AB12', 275.5);
  assert.equal(qr.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.throws(() => paymentIntentPayload('PAY-AB12', 0), /positive/);
  assert.throws(() => paymentIntentPayload('PAY-AB12', 1.001), /two decimal places/);
});

test('payment reply uses Groq Qwen with JSON mode and accepts the expected response', async () => {
  let request;
  const reply = await createLocalizedPaymentReply(
    'I want to pay ₹275.50 for the room.',
    'test-key',
    async (url, options) => {
      request = { url, ...JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                language: 'English',
                wants_payment: true,
                reply: 'Reply with 👍 for a ₹275.50 UPI QR.',
                qr_caption: 'Verify the payee and amount in your UPI app.',
              }),
            },
          }],
        }),
      };
    }
  );

  assert.equal(request.model, 'qwen/qwen3.8-27b');
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.equal(request.max_completion_tokens, 600);
  assert.equal(request.reasoning_effort, 'none');
  assert.equal(reply.wantsPayment, true);
  assert.equal(reply.amount, 275.5);
  assert.match(request.messages[0].content, /reply only in that language/);
  assert.match(request.messages[0].content, /Do not code-switch/);
  assert.match(request.messages[0].content, /same single language for the reply and QR caption/);
  assert.match(reply.qrCaption, /shivamsrevankar@oksbi/);
  assert.match(reply.qrCaption, /₹275\.5/);
  assert.match(reply.qrCaption, /cannot verify payment/);
  assert.match(request.messages[0].content, /exact amount requested is ₹275\.5/);
});

test('payment reply asks for an amount instead of assuming a default', async () => {
  const reply = await createLocalizedPaymentReply(
    'I want to make a payment.',
    'test-key',
    async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.match(request.messages[0].content, /Never assume one/);
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                language: 'English',
                wants_payment: true,
                reply: 'What amount would you like to pay?',
                qr_caption: 'Verify payment details.',
              }),
            },
          }],
        }),
      };
    }
  );
  assert.equal(reply.amount, null);
  assert.equal(reply.qrCaption, null);
});

test('post-QR thumbs-up confirms the guest report without claiming payment is verified', async () => {
  let prompt;
  const reply = await createLocalizedPaymentReply(
    '👍',
    'test-key',
    async (_url, options) => {
      prompt = JSON.parse(options.body).messages[0].content;
      return {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                language: 'English',
                wants_payment: true,
                reply: 'We received your confirmation. Payment is pending staff verification.',
                qr_caption: 'Verify the payment details.',
              }),
            },
          }],
        }),
      };
    },
    { amount: 275.5, language: 'English', confirmationReceived: true }
  );

  assert.match(prompt, /reporting that they sent payment/);
  assert.match(prompt, /not verified and remains pending/);
  assert.match(prompt, /do not claim it is complete/);
  assert.equal(reply.reply, 'We received your confirmation. Payment is pending staff verification.');
  assert.equal(reply.wantsPayment, false);
});

test('voice payment replies and stored QR captions use the detected language', async () => {
  const outputs = ['मुझे ₹500 का QR भेजें।', '₹500 के लिए UPI QR। भुगतान से पहले विवरण जाँचें।'];
  let calls = 0;
  const localized = await localizePaymentReply(
    {
      language: 'English',
      reply: 'Reply with thumbs up to receive the QR.',
      qrCaption: 'UPI QR for ₹500. Verify details before paying.',
    },
    'Hindi',
    'test-key',
    async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.match(request.messages[0].content, /into Hindi/);
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: outputs[calls++] } }] }),
      };
    }
  );

  assert.equal(localized.language, 'Hindi');
  assert.match(localized.reply, /मुझे/);
  assert.match(localized.qrCaption, /₹500/);
  assert.equal(calls, 2);
});
