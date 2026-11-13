const path = require('path');
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch (e) {
  console.warn('No .env loaded:', e.message);
}
if (!process.env.GROQ_API_KEY) console.warn('WARNING: GROQ_API_KEY is not set - auto-replies will fail');

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

const GROQ_MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT =
  'You are the WhatsApp assistant for Sunset Bay Resort, Calangute, Goa. Guests write in Konkani (Goan), Marathi, Hindi or English, in Devanagari or Roman script. ' +
  'First decide which of these four languages the guest used, then reply briefly and politely in that same language and the same script. ' +
  'Konkani and Marathi are different languages: never answer Konkani in Marathi or the reverse. ' +
  'Goan Konkani markers: "borem", "dis", "kitem", "mhaka", "tuka", "asa", "mellta", "zai", "kosso", "kitlem", "ho/hi/hem", "ani", "ghor", "khoim" (Devanagari: बरें, दीस, कितें, मका, तुका, आसा, मेळ्टा, जाय, कसो, कितलें, आनी, घर, खैं). If you see such words, the language is Konkani. ' +
  'Konkani reply examples: "Dev borem dis dium! Tuka kitem zai?", "Rum mellta, amcho staff ek khinn bhitor sanggtolo.", "देव बरें दीस दिओ! तुका कितें जाय?". Konkani written in Roman script must be answered in Konkani in Roman script, never in English. ' +
  'If the message is a greeting, answer with a warm greeting in that language: Konkani "Dev borem dis dium" (Devanagari: "देव बरें दीस दिओ"), Marathi "नमस्कार", Hindi "नमस्ते", English "Hello", then offer help. ' +
  'Do not invent prices, availability or policies; if you do not know, say staff will confirm shortly. Output only the reply.';

// Replies to the guest's message in the same language and script it was written in.
async function replyInLanguageOf(text) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_completion_tokens: 600,
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content:
            SYSTEM_PROMPT,
        },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Groq HTTP ' + r.status);
  const out = d.choices && d.choices[0] && d.choices[0].message.content.trim();
  if (!out) throw new Error('Groq returned an empty reply');
  return out;
}

// Invisible marker on every bot reply so the bot never answers its own messages.
const BOT_MARK = '\u200B';

// message_create fires for incoming messages and for messages sent from this account,
// which is how a self-chat (messaging your own number) shows up.
client.on('message_create', async (msg) => {
  if (msg.isStatus || msg.from.endsWith('@g.us') || msg.to.endsWith('@g.us') || !msg.body) return;
  if (msg.body.startsWith(BOT_MARK)) return;
  if (msg.fromMe && msg.to !== msg.from) return; // ignore messages we send to other people (e.g. the Message tab)
  const chat = msg.fromMe ? msg.to : msg.from;
  try {
    if (/^\s*hi[\s!.]*$/i.test(msg.body)) {
      const sameHi = chat === '919404433123@c.us'; // this guest gets "hi" back, everyone else "Hello"
      await client.sendMessage(chat, BOT_MARK + (sameHi ? 'hi' : 'Hello'));
      return;
    }
    await client.sendMessage(chat, BOT_MARK + (await replyInLanguageOf(msg.body)));
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
