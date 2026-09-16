import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { login } from './login.js';
import { fetchSalonList, excludeConfiguredSalons } from './salons.js';
import { fetchSalesDetailRows } from './salesExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'sales-raw.json');

function monthRange(monthsAgo) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const to = monthsAgo === 0 ? now : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);
  return { from, to };
}

async function exportSalon(page, salon) {
  await page.goto(salon.url, { waitUntil: 'domcontentloaded' });

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(1);

  const thisMonthRows = await fetchSalesDetailRows(page, thisMonth);
  const lastMonthRows = await fetchSalesDetailRows(page, lastMonth);

  return [...thisMonthRows, ...lastMonthRows].map((row) => ({ ...row, salon: salon.name }));
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  console.log('[start] 売上ダッシュボード用データのエクスポートを開始します');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const rows = [];
  const errors = [];

  try {
    await login(page);
    console.log('[login] ログイン成功');

    const allSalons = await fetchSalonList(page);
    const salons = excludeConfiguredSalons(allSalons);
    console.log(`[salons] 対象サロン数: ${salons.length}件`);

    for (const salon of salons) {
      console.log(`[salon] ${salon.name} を処理中...`);
      try {
        const salonRows = await exportSalon(page, salon);
        rows.push(...salonRows);
        console.log(`  [sales] ${salonRows.length}件の明細を取得しました`);
      } catch (err) {
        console.error(`  [salon:error] ${salon.name}: ${err.message}`);
        errors.push({ salon: salon.name, error: err.message });
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`[done] ${rows.length}件の明細を ${OUT_FILE} に書き出しました`);

  if (errors.length > 0) {
    console.log('[summary:errors]');
    for (const e of errors) console.log(`  - ${e.salon}: ${e.error}`);
    process.exitCode = 1;
  }
}

main();
