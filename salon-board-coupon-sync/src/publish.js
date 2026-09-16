import { selectors, env } from './config.js';

/**
 * クーポン並び替えの保存だけではHot Pepper Beauty上に反映されないため、
 * 掲載管理TOPから「反映申請」を行い、本番反映を予約する。
 */
export async function requestReflect(page) {
  if (env.dryRun) {
    console.log('  [publish] DRY_RUN=true のため、反映申請は行いません。');
    return { requested: false };
  }

  await page.click(selectors.publish.navTabSelector);
  await page.click(selectors.publish.topSubTabSelector);
  await page.waitForLoadState('networkidle');

  const button = page.locator(selectors.publish.requestReflectButtonSelector);
  const disabled = await button.isDisabled().catch(() => false);
  if (disabled) {
    console.log('  [publish] 反映申請ボタンが無効化されています（変更なし、または既に反映予約済み）。');
    return { requested: false };
  }

  await Promise.all([page.waitForLoadState('networkidle'), button.click()]);

  const reflected = await page
    .locator(selectors.publish.reflectSuccessIndicator)
    .first()
    .isVisible()
    .catch(() => false);

  if (!reflected) {
    throw new Error('クーポン掲載情報の反映予約が確認できませんでした。画面を確認してください。');
  }

  console.log('  [publish] 本番反映を予約しました。');
  return { requested: true };
}
