import { selectors, env } from './config.js';

/**
 * サロンボードにログインする。
 * ログイン失敗時（ID/パスワード相違、予期しない画面遷移など）は例外を投げる。
 */
export async function login(page) {
  await page.goto(selectors.loginUrl, { waitUntil: 'domcontentloaded' });

  await page.fill(selectors.login.idInput, env.loginId);
  await page.fill(selectors.login.passwordInput, env.password);
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(selectors.login.submitButton),
  ]);

  const loggedIn = await page
    .locator(selectors.login.successIndicator)
    .first()
    .isVisible()
    .catch(() => false);

  if (!loggedIn) {
    throw new Error(
      'サロンボードへのログインに失敗しました。ID/パスワード、または画面構造の変化（要セレクタ再検証）を確認してください。'
    );
  }
}
