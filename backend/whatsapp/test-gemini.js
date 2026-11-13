// Quick check of the Gemini greeting call: node --env-file=.env test-gemini.js
const MODEL = 'gemini-3.1-flash-lite';
async function greet(text) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Detect the language and script of the user message and reply with only a short friendly "hi" greeting in that same language and script. Output only the greeting.' }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const d = await r.json();
  if (!r.ok) return 'ERROR: ' + JSON.stringify(d.error);
  return d.candidates[0].content.parts.map((p) => p.text).join('').trim();
}
(async () => {
  for (const t of ['Hello, is breakfast included?', 'नमस्ते, कमरा उपलब्ध है?', 'Hola, ¿tienen piscina?', 'Привет, есть свободные номера?']) {
    console.log(JSON.stringify(t), '->', await greet(t));
  }
})();
