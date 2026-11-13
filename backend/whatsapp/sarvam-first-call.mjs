import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SarvamAIClient } from 'sarvamai';

const directory = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.join(directory, '.env'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) throw new Error('Set SARVAM_API_KEY in backend/whatsapp/.env first.');

const audioPath = process.argv[2];
if (!audioPath || !existsSync(audioPath)) {
  throw new Error('Usage: node sarvam-first-call.mjs <path-to-audio-file>');
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
const result = await client.speechToText.transcribe({
  file: createReadStream(audioPath),
  model: 'saaras:v4',
  mode: 'translate',
});

console.log(result.transcript);
