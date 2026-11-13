const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPaymentQr,
  createLocalizedPaymentReply,
  paymentIntentPayload,
  isPaymentRelated,
  isThumbsUp,
} = require('./payment_intent');

test('payment intent detection recognizes common English and Indian-language messages', () => {
  assert.equal(isPaymentRelated('Can I make a payment?'), true);
  assert.equal(isPaymentRelated('How much does this cost?'), true);
  assert.equal(isPaymentRelated('मुझे भुगतान करना है'), true);
  assert.equal(isPaymentRelated('मला पैसे भरायचे आहेत'), true);
  assert.equal(isPaymentRelated('Can I get extra towels?'), false);
});

test('thumbs-up confirmation accepts plain and skin-tone emoji only', () => {
  assert.equal(isThumbsUp('👍'), true);
  assert.equal(isThumbsUp('👍🏻'), true);
  assert.equal(isThumbsUp('👍️'), true);
  assert.equal(isThumbsUp('yes 👍'), false);
  assert.equal(isThumbsUp('❤️'), false);
});

test('UPI QR targets the configured payee and fixed ₹50 amount', async () => {
  const payload = paymentIntentPayload('PAY-AB12');
  const parsed = new URL(payload);
  const params = parsed.searchParams;
  assert.equal(parsed.protocol, 'upi:');
  assert.equal(parsed.hostname, 'pay');
  assert.equal(params.get('pa'), 'shivamsrevankar@oksbi');
  assert.equal(params.get('am'), '50.00');
  assert.equal(params.get('cu'), 'INR');
  assert.equal(params.get('tr'), 'PAY-AB12');

  const qr = await createPaymentQr('PAY-AB12');
  assert.equal(qr.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});

test('payment reply uses Groq Llama with JSON mode and accepts the expected response', async () => {
  let request;
  const reply = await createLocalizedPaymentReply(
    'I want to make the payment for the room.',
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
                reply: 'Reply with 👍 for a ₹50 UPI QR.',
                qr_caption: 'Verify the payee and amount in your UPI app.',
              }),
            },
          }],
        }),
      };
    }
  );

  assert.equal(request.model, 'llama-3.3-70b-versatile');
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.equal(request.max_completion_tokens, 600);
  assert.equal(reply.wantsPayment, true);
  assert.match(reply.qrCaption, /shivamsrevankar@oksbi/);
  assert.match(reply.qrCaption, /cannot verify payment/);
});
