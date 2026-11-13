// Tests the real prompt from server.js: node --env-file=.env test-groq.js
const src = require('fs').readFileSync(__dirname + '/server.js', 'utf8');
const SYSTEM_PROMPT = eval(src.match(/const SYSTEM_PROMPT =([\s\S]*?);\n/)[1]);
const MODEL = src.match(/const GROQ_MODEL = '([^']+)'/)[1];

async function reply(text) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_completion_tokens: 600,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  const d = await r.json();
  if (!r.ok) return 'ERROR: ' + JSON.stringify(d.error);
  return d.choices[0].message.content.trim();
}
(async () => {
  const tests = [
    'Dev borem dis dium',
    'देव बरें दीस, रूम मेळटा काय?',
    'नमस्कार, खोली उपलब्ध आहे का?',
    'नमस्ते, कमरा मिलेगा?',
    'Good morning',
    'Namaskar, nashta free asa ka?',
  ];
  for (const t of tests) console.log(JSON.stringify(t), '->', await reply(t));
})();
