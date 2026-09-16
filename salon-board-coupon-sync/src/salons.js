import { selectors, excludedSalonNamePatterns } from './config.js';

/**
 * サロン一覧画面から、管理対象の全サロン（名前・個別ページURL）を取得する。
 * ログイン直後は既にサロン一覧画面にいるため、ここでの画面遷移は行わない。
 * 戻り値: [{ name: string, url: string }]
 */
export async function fetchSalonList(page) {
  const links = page.locator(selectors.salonList.rowLinkSelector);
  const count = await links.count();

  const salons = [];
  for (let i = 0; i < count; i++) {
    const link = links.nth(i);
    const name = (await link.textContent().catch(() => null))?.trim();
    const href = await link.getAttribute('href').catch(() => null);
    if (!name || !href) continue;
    salons.push({ name, url: new URL(href, page.url()).toString() });
  }

  return salons;
}

/**
 * config/excluded-salons.json に登録された名前（部分一致）を含むサロンを除外する。
 */
export function excludeConfiguredSalons(salons) {
  return salons.filter(
    (salon) => !excludedSalonNamePatterns.some((pattern) => salon.name.includes(pattern))
  );
}
