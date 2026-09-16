import { selectors, env } from './config.js';

function formatDate(d) {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 「売上管理」＞「売上明細」を来店日で直近 lookbackDays 日間に絞り込み、
 * カテゴリに「クーポン」を含む行（メニュー付クーポンでの会計）からクーポン名を集計する。
 * 戻り値: Set<string> クーポン名の集合
 */
export async function fetchCouponNamesWithRecentSales(page) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - env.lookbackDays);

  await page.click(selectors.salesDetail.navTabSelector);
  await page.click(selectors.salesDetail.subTabSelector);
  await page.waitForLoadState('networkidle');

  await page.click(selectors.salesDetail.visitDateRadioSelector);
  await page.fill(selectors.salesDetail.dateFromInput, formatDate(from));
  await page.fill(selectors.salesDetail.dateToInput, formatDate(to));

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selectors.salesDetail.searchButtonSelector),
  ]);

  const couponNames = new Set();

  for (;;) {
    const rows = page.locator(selectors.salesDetail.rowSelector);
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const category = (
        await row.locator(selectors.salesDetail.categoryInRowSelector).innerText().catch(() => '')
      ).trim();
      if (!category.includes('クーポン')) continue;

      const menuCellText = await row
        .locator(selectors.salesDetail.menuNameInRowSelector)
        .innerText()
        .catch(() => null);
      const menuName = menuCellText?.split('\n')[0]?.trim();
      if (menuName) couponNames.add(menuName);
    }

    const nextButton = page.locator(selectors.salesDetail.nextPageButtonSelector);
    const hasNext = await nextButton.isVisible().catch(() => false);
    if (!hasNext) break;
    const nextDisabled = await nextButton.isDisabled().catch(() => false);
    if (nextDisabled) break;

    await Promise.all([page.waitForLoadState('networkidle'), nextButton.click()]);
  }

  return couponNames;
}
