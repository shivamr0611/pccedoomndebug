// Quick check of Gemini language detection and translation: node --env-file=.env test-gemini.js
const MODEL = 'gemini-3.1-flash-lite';
async function translate(text) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Detect the language of the user message and translate it to English. Return JSON only with exactly two keys: "language" and "english". If the message is already English, return it unchanged in "english".' }] },
      contents: [{ role: 'user', parts: [{ text: 'Analyze this message:\n<<<\n' + text + '\n>>>' }] }],
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const d = await r.json();
  if (!r.ok) return 'ERROR: ' + JSON.stringify(d.error);
  return d.candidates[0].content.parts.map((p) => p.text).join('').trim();
}
(async () => {
  for (const t of ['Hello, is breakfast included?', 'नमस्ते, कमरा उपलब्ध है?', 'Hola, ¿tienen piscina?', 'Привет, есть свободные номера?']) {
    console.log(JSON.stringify(t), '->', await translate(t));
  }
})();
