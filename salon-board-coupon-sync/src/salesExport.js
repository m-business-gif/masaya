import { selectors, assertExportSelectorsCalibrated } from './config.js';
import { pickDate } from './sales.js';

function parseAmount(text) {
  if (!text) return 0;
  const digits = text.replace(/[^\d.-]/g, '');
  return digits ? Number(digits) : 0;
}

async function cellText(row, selector) {
  return (await row.locator(selector).innerText().catch(() => '')).trim();
}

/**
 * 「売上管理」＞「売上明細」を来店日で from〜to に絞り込み、行ごとに
 * 売上ダッシュボード用の明細（日付・スタッフ・カテゴリ・品名・金額・客区分・予約経路）を取得する。
 * 事前に config/selectors.json の salesDetail.exportColumns を検証・設定しておくこと
 * （assertExportSelectorsCalibrated が未検証なら例外を投げる）。
 * 戻り値: [{ date, staff, category, itemName, amount, customerType, reservationRoute }]
 */
export async function fetchSalesDetailRows(page, { from, to }) {
  assertExportSelectorsCalibrated();

  const cols = selectors.salesDetail.exportColumns;

  await page.click(selectors.salesDetail.navTabSelector);
  await page.click(selectors.salesDetail.subTabSelector);
  await page.waitForLoadState('networkidle');

  await page.click(selectors.salesDetail.visitDateRadioSelector);
  await pickDate(page, selectors.salesDetail.dateFromInput, from);
  await pickDate(page, selectors.salesDetail.dateToInput, to);

  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selectors.salesDetail.searchButtonSelector),
  ]);

  const results = [];

  for (;;) {
    const rows = page.locator(selectors.salesDetail.rowSelector);
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);

      const category = await cellText(row, selectors.salesDetail.categoryInRowSelector);
      const menuCellText = await row
        .locator(selectors.salesDetail.menuNameInRowSelector)
        .innerText()
        .catch(() => null);
      const itemName = menuCellText?.split('\n')[0]?.trim();
      if (!itemName) continue;

      const date = await cellText(row, cols.dateInRowSelector);
      const staff = await cellText(row, cols.staffInRowSelector);
      const amount = parseAmount(await cellText(row, cols.amountInRowSelector));
      const customerType = await cellText(row, cols.customerTypeInRowSelector);
      const reservationRoute = await cellText(row, cols.reservationRouteInRowSelector);

      results.push({ date, staff, category, itemName, amount, customerType, reservationRoute });
    }

    const nextButton = page.locator(selectors.salesDetail.nextPageButtonSelector);
    const hasNext = await nextButton.isVisible().catch(() => false);
    if (!hasNext) break;
    const nextDisabled = await nextButton.isDisabled().catch(() => false);
    if (nextDisabled) break;

    await Promise.all([page.waitForLoadState('networkidle'), nextButton.click()]);
  }

  return results;
}
