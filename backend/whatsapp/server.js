const http = require('http');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const PORT = 3001;
const COUNTRY_CODE = '91'; // numbers without a country code are assumed to be Indian

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
});
let ready = false;

client.on('qr', (qr) => {
  console.log('Scan this QR with WhatsApp > Linked devices:');
  qrcode.generate(qr, { small: true });
});
client.on('ready', () => {
  ready = true;
  console.log('WhatsApp client ready');
});
client.on('disconnected', () => {
  ready = false;
});
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'];

// Asks Gemini to say "hi" in the same language (and script) as the guest's message.
async function greetInLanguageOf(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: 'Detect the language and script of the user message and reply with only a short friendly "hi" greeting in that same language and script. Output only the greeting.' }],
            },
            contents: [{ role: 'user', parts: [{ text: text }] }],
            generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
          }),
        }
      );
      const d = await r.json();
      if (!r.ok) {
        lastError = new Error((d.error && d.error.message) || 'Gemini HTTP ' + r.status);
        continue;
      }
      const out = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts.map((p) => p.text).join('').trim();
      if (out) return out;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return 'hi';
}

client.on('message', async (msg) => {
  if (msg.fromMe || msg.isStatus || msg.from.endsWith('@g.us') || !msg.body) return;
  try {
    await msg.reply(await greetInLanguageOf(msg.body));
  } catch (e) {
    console.error('Auto-reply failed:', e.message);
  }
});

client.initialize()

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', ...cors });
  res.end(JSON.stringify(obj));
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return reply(res, 204, {});
    if (req.method !== 'POST' || req.url !== '/send') return reply(res, 404, { error: 'not found' });
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      try {
        if (!ready) return reply(res, 503, { error: 'WhatsApp not ready - scan the QR in the server terminal' });
        const { number, message } = JSON.parse(raw || '{}');
        let digits = String(number || '').replace(/\D/g, '');
        if (digits.length === 10) digits = COUNTRY_CODE + digits;
        if (!digits || !message) return reply(res, 400, { error: 'number and message required' });
        await client.sendMessage(digits + '@c.us', message);
        reply(res, 200, { ok: true });
      } catch (e) {
        reply(res, 500, { error: e.message });
      }
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log('WhatsApp API on http://127.0.0.1:' + PORT));
