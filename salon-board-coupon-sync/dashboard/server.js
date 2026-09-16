import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { computeDashboard } from './lib/aggregate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'sales-raw.json');
const TARGETS_FILE = path.join(__dirname, '..', 'config', 'targets.json');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', (req, res) => {
  if (!existsSync(DATA_FILE)) {
    res.status(404).json({
      error: '売上データが見つかりません。先に npm run export:sales（実データ）または npm run dashboard:mock（お試し用ダミーデータ）を実行してください。',
    });
    return;
  }

  const { generatedAt, rows } = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
  const targets = existsSync(TARGETS_FILE) ? JSON.parse(readFileSync(TARGETS_FILE, 'utf-8')) : {};

  const dashboard = computeDashboard(rows, targets);
  res.json({ ...dashboard, dataGeneratedAt: generatedAt });
});

app.listen(PORT, () => {
  console.log(`[dashboard] http://localhost:${PORT} で起動しました`);
});
