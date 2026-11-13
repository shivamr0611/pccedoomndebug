const LANGUAGE_CODES = {
  as: 'Assamese',
  bn: 'Bengali',
  brx: 'Bodo',
  doi: 'Dogri',
  en: 'English',
  gu: 'Gujarati',
  hi: 'Hindi',
  kn: 'Kannada',
  ks: 'Kashmiri',
  kok: 'Konkani',
  mai: 'Maithili',
  ml: 'Malayalam',
  mni: 'Manipuri',
  mr: 'Marathi',
  ne: 'Nepali',
  od: 'Odia',
  pa: 'Punjabi',
  sa: 'Sanskrit',
  sat: 'Santali',
  sd: 'Sindhi',
  ta: 'Tamil',
  te: 'Telugu',
  ur: 'Urdu',
};

const SCRIPT_LANGUAGES = [
  [/[\u0980-\u09ff]/gu, 'Bengali'],
  [/[\u0a00-\u0a7f]/gu, 'Punjabi'],
  [/[\u0a80-\u0aff]/gu, 'Gujarati'],
  [/[\u0b00-\u0b7f]/gu, 'Odia'],
  [/[\u0b80-\u0bff]/gu, 'Tamil'],
  [/[\u0c00-\u0c7f]/gu, 'Telugu'],
  [/[\u0c80-\u0cff]/gu, 'Kannada'],
  [/[\u0d00-\u0d7f]/gu, 'Malayalam'],
];

function hasScriptCharacters(text, pattern, minimum = 3) {
  return (text.match(pattern) || []).length >= minimum;
}

function getVoiceLanguageHint(transcript, languageCode) {
  const text = String(transcript || '');
  const code = String(languageCode || '').toLowerCase().split('-')[0];
  const codeLanguage = LANGUAGE_CODES[code] || null;
  if (codeLanguage && codeLanguage !== 'English') return codeLanguage;

  const marathiMarkers = /(?:आहेत?|नाही|मला|तुम्ही|आम्ही|पाहिजे|खोली|माझ्या|aahe|ahe|ahet|mala|tumhi|amhi|pahije|kholi|majhya|madhe)/iu;
  if (hasScriptCharacters(text, /[\u0900-\u097f]/gu)) {
    return marathiMarkers.test(text) ? 'Marathi' : 'Hindi';
  }
  for (const [pattern, language] of SCRIPT_LANGUAGES) {
    if (hasScriptCharacters(text, pattern)) return language;
  }
  if (hasScriptCharacters(text, /[\u0600-\u06ff]/gu)) return 'Urdu';

  const romanized = text.toLowerCase();
  if (/\b(?:mujhe|aap|hum|chahiye|kya|kamra|mere|hai|hain)\b/u.test(romanized)) return 'Hindi';
  if (/\b(?:mala|tumhi|amhi|pahije|kholi|majhya|aahe|ahet|kay)\b/u.test(romanized)) return 'Marathi';
  return codeLanguage;
}

module.exports = { getVoiceLanguageHint };
