import { selectors, env } from './config.js';

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 直近 lookbackDays 日間に予約実績のあったクーポン名の集合を取得する。
 * 「予約実績がある」＝その期間内の予約明細に、当該クーポンが選択されていたもの。
 * 戻り値: Set<string> クーポン名の集合
 */
export async function fetchCouponNamesWithRecentReservations(page) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - env.lookbackDays);

  await page.goto(selectors.reservationList.url, { waitUntil: 'domcontentloaded' });

  await page.fill(selectors.reservationList.dateRangeFromInput, formatDate(from));
  await page.fill(selectors.reservationList.dateRangeToInput, formatDate(to));
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selectors.reservationList.searchButton),
  ]);

  const rows = page.locator(selectors.reservationList.rowSelector);
  const count = await rows.count();

  const couponNames = new Set();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const couponCell = row.locator(selectors.reservationList.couponNameInRowSelector);
    const name = (await couponCell.textContent().catch(() => null))?.trim();
    if (name) couponNames.add(name);
  }

  return couponNames;
}
