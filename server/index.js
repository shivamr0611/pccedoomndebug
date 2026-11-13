import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataFile = path.resolve(process.env.MOCK_PAYMENTS_DB || path.join(root, 'server/data/transactions.json'));
const port = Number(process.env.PORT || 5173);
const app = express();

async function readTransactions() {
  let contents;
  try {
    contents = await readFile(dataFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const transactions = JSON.parse(contents);
  if (!Array.isArray(transactions)) throw new Error('Demo transaction data must be a JSON array.');
  return transactions;
}

app.get('/api/transactions', async (_req, res, next) => {
  try {
    res.json(await readTransactions());
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  console.error('Transaction history error:', error.message);
  res.status(500).json({ error: 'Could not load sample transaction history.' });
});

if (process.env.NODE_ENV === 'production') {
  const buildDirectory = path.join(root, 'dist');
  app.use(express.static(buildDirectory));
  app.use((_req, res) => res.sendFile(path.join(buildDirectory, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`UPI checkout ready at http://localhost:${port}`);
});
