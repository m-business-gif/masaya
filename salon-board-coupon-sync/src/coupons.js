import { selectors, env } from './config.js';

/**
 * クーポン管理画面から、現在のクーポン一覧（表示順つき）を取得する。
 * 戻り値: [{ name: string, order: number, rowIndex: number }]
 */
export async function fetchCoupons(page) {
  await page.click(selectors.couponList.navTabSelector);
  await page.click(selectors.couponList.subTabSelector);
  await page.waitForLoadState('networkidle');

  const rows = page.locator(selectors.couponList.rowSelector);
  const count = await rows.count();

  const coupons = [];
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const name = (await row.locator(selectors.couponList.couponNameInRowSelector).textContent().catch(() => null))?.trim();
    const orderRaw = await row.locator(selectors.couponList.orderInputInRowSelector).inputValue().catch(() => null);
    if (!name || orderRaw === null) continue;
    coupons.push({ name, order: Number(orderRaw), rowIndex: i });
  }

  return coupons;
}

/**
 * 予約実績のあるクーポンを上位に、それ以外を下位に並べた新しい順序を計算する。
 * 各グループ内では元の表示順を維持する（不要な入れ替えを避けるため）。
 */
export function computeBoostedOrder(coupons, couponNamesWithReservations) {
  const sorted = [...coupons].sort((a, b) => a.order - b.order);

  const boosted = sorted.filter((c) => couponNamesWithReservations.has(c.name));
  const rest = sorted.filter((c) => !couponNamesWithReservations.has(c.name));

  const newOrder = [...boosted, ...rest];
  return newOrder.map((c, idx) => ({ ...c, newOrder: idx + 1 }));
}

/**
 * 計算済みの新しい順序を実際の画面に反映して保存する。
 * env.dryRun が true の場合は書き込みを行わず、変更予定をログ出力するだけ。
 */
export async function applyOrder(page, plan) {
  const changes = plan.filter((c) => c.order !== c.newOrder);

  if (changes.length === 0) {
    console.log('[coupons] 並び替え不要（既に最適な順序です）');
    return { applied: false, changes: [] };
  }

  console.log(`[coupons] ${changes.length}件のクーポンの表示順を変更します:`);
  for (const c of changes) {
    console.log(`  - ${c.name}: ${c.order} -> ${c.newOrder}`);
  }

  if (env.dryRun) {
    console.log('[coupons] DRY_RUN=true のため、実際の保存は行いません。');
    return { applied: false, changes };
  }

  const rows = page.locator(selectors.couponList.rowSelector);
  for (const c of plan) {
    const row = rows.nth(c.rowIndex);
    await row.locator(selectors.couponList.orderInputInRowSelector).fill(String(c.newOrder));
  }

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selectors.couponList.saveButton),
  ]);

  const saved = await page
    .locator(selectors.couponList.saveSuccessIndicator)
    .first()
    .isVisible()
    .catch(() => false);

  if (!saved) {
    throw new Error('クーポン表示順の保存確認ができませんでした。画面を確認してください。');
  }

  console.log('[coupons] 保存が完了しました。');
  return { applied: true, changes };
}
