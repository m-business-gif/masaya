import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { env, assertSelectorsCalibrated } from './config.js';
import { login } from './login.js';
import { fetchSalonList, excludeConfiguredSalons } from './salons.js';
import { fetchCouponNamesWithRecentReservations } from './reservations.js';
import { fetchCoupons, computeBoostedOrder, applyOrder } from './coupons.js';
import { requestReflect } from './publish.js';

const ARTIFACTS_DIR = new URL('../artifacts/', import.meta.url).pathname;

function sanitizeFileName(name) {
  return name.replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, '_');
}

async function processSalon(page, salon) {
  await page.goto(salon.url, { waitUntil: 'domcontentloaded' });

  const couponNamesWithReservations = await fetchCouponNamesWithRecentReservations(page);
  console.log(`  [reservations] 直近${env.lookbackDays}日間に予約のあったクーポン: ${couponNamesWithReservations.size}件`);

  const coupons = await fetchCoupons(page);
  console.log(`  [coupons] 現在のクーポン数: ${coupons.length}件`);

  const plan = computeBoostedOrder(coupons, couponNamesWithReservations);
  const orderResult = await applyOrder(page, plan);

  if (orderResult.applied) {
    const publishResult = await requestReflect(page);
    return { ...orderResult, ...publishResult };
  }

  return { ...orderResult, requested: false };
}

async function main() {
  assertSelectorsCalibrated();
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  console.log(`[start] dryRun=${env.dryRun} lookbackDays=${env.lookbackDays}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  try {
    await login(page);
    console.log('[login] ログイン成功');

    const allSalons = await fetchSalonList(page);
    const salons = excludeConfiguredSalons(allSalons);
    const excludedCount = allSalons.length - salons.length;
    console.log(`[salons] 対象サロン数: ${salons.length}件（除外設定: ${excludedCount}件）`);

    for (const salon of salons) {
      console.log(`[salon] ${salon.name} を処理中...`);
      try {
        const result = await processSalon(page, salon);
        results.push({ salon: salon.name, ...result });
      } catch (err) {
        console.error(`  [salon:error] ${salon.name}: ${err.message}`);
        await page
          .screenshot({ path: `${ARTIFACTS_DIR}error-${sanitizeFileName(salon.name)}.png`, fullPage: true })
          .catch(() => {});
        results.push({ salon: salon.name, error: err.message });
      }
    }
  } catch (err) {
    console.error('[error]', err.message);
    await page.screenshot({ path: `${ARTIFACTS_DIR}error.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  console.log('[summary]');
  for (const r of results) {
    if (r.error) {
      console.log(`  - ${r.salon}: ERROR ${r.error}`);
    } else {
      console.log(`  - ${r.salon}: applied=${r.applied} changedCount=${r.changes.length} reflectRequested=${r.requested}`);
    }
  }

  if (results.some((r) => r.error)) process.exitCode = 1;
}

main();
