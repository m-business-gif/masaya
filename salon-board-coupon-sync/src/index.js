import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { env, assertSelectorsCalibrated } from './config.js';
import { login } from './login.js';
import { fetchCouponNamesWithRecentReservations } from './reservations.js';
import { fetchCoupons, computeBoostedOrder, applyOrder } from './coupons.js';

const ARTIFACTS_DIR = new URL('../artifacts/', import.meta.url).pathname;

async function main() {
  assertSelectorsCalibrated();
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  console.log(`[start] dryRun=${env.dryRun} lookbackDays=${env.lookbackDays}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await login(page);
    console.log('[login] ログイン成功');

    const couponNamesWithReservations = await fetchCouponNamesWithRecentReservations(page);
    console.log(`[reservations] 直近${env.lookbackDays}日間に予約のあったクーポン: ${couponNamesWithReservations.size}件`);

    const coupons = await fetchCoupons(page);
    console.log(`[coupons] 現在のクーポン数: ${coupons.length}件`);

    const plan = computeBoostedOrder(coupons, couponNamesWithReservations);
    const result = await applyOrder(page, plan);

    console.log(`[done] applied=${result.applied} changedCount=${result.changes.length}`);
  } catch (err) {
    console.error('[error]', err.message);
    await page.screenshot({ path: `${ARTIFACTS_DIR}error.png`, fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
