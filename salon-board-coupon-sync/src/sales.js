import { selectors, env } from './config.js';

/**
 * クリック式カレンダーピッカーで日付欄に日付をセットする。
 * 欄をクリックしてピッカーを開き、見出しの年・月が目的の年月になるまで
 * 「前の月」「次の月」を押し、最後に日付の数字をクリックする。
 * ピッカーは同時に1つしか開かない前提（1つずつ順番に処理する）。
 */
async function pickDate(page, dateInputSelector, targetDate) {
  await page.click(dateInputSelector);

  const yearLabel = page.locator(selectors.salesDetail.datePicker.yearLabelSelector).first();
  const monthLabel = page.locator(selectors.salesDetail.datePicker.monthLabelSelector).first();
  const prevButton = page.locator(selectors.salesDetail.datePicker.prevMonthButtonSelector);
  const nextButton = page.locator(selectors.salesDetail.datePicker.nextMonthButtonSelector);

  const targetYm = targetDate.getFullYear() * 12 + targetDate.getMonth();

  for (let i = 0; i < 12; i++) {
    const year = Number((await yearLabel.textContent()).trim());
    const month = Number((await monthLabel.textContent()).trim().replace('月', ''));
    const shownYm = year * 12 + (month - 1);

    if (shownYm === targetYm) break;
    if (shownYm < targetYm) {
      await nextButton.click();
    } else {
      await prevButton.click();
    }
    await page.waitForTimeout(150);
  }

  await page.locator(`text="${targetDate.getDate()}"`).first().click();
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
  await pickDate(page, selectors.salesDetail.dateFromInput, from);
  await pickDate(page, selectors.salesDetail.dateToInput, to);

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
