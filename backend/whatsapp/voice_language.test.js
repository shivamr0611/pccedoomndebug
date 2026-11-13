const test = require('node:test');
const assert = require('node:assert/strict');
const { getVoiceLanguageHint } = require('./voice_language');

test('voice language uses the transcription language code when available', () => {
  assert.equal(getVoiceLanguageHint('नमस्ते', 'hi-IN'), 'Hindi');
  assert.equal(getVoiceLanguageHint('bonjour', 'en-IN'), 'English');
});

test('non-English transcript script overrides an erroneous English language code', () => {
  assert.equal(getVoiceLanguageHint('मुझे कमरा चाहिए', 'en-IN'), 'Hindi');
  assert.equal(getVoiceLanguageHint('मला खोली पाहिजे', 'en-IN'), 'Marathi');
  assert.equal(getVoiceLanguageHint('வணக்கம் எப்படி இருக்கிறீர்கள்', 'en-IN'), 'Tamil');
});

test('romanized Hindi and Marathi are detected when transcription code says English', () => {
  assert.equal(getVoiceLanguageHint('mujhe paani chahiye', 'en-IN'), 'Hindi');
  assert.equal(getVoiceLanguageHint('mala paani pahije', 'en-IN'), 'Marathi');
});
