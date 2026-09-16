import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const selectors = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'config', 'selectors.json'), 'utf-8')
);

export const excludedSalonNamePatterns = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'config', 'excluded-salons.json'), 'utf-8')
);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}

export const env = {
  loginId: requireEnv('SALON_BOARD_LOGIN_ID'),
  password: requireEnv('SALON_BOARD_PASSWORD'),
  dryRun: (process.env.DRY_RUN ?? 'true') !== 'false',
  lookbackDays: Number(process.env.LOOKBACK_DAYS ?? '7'),
};

export function assertSelectorsCalibrated() {
  const flat = JSON.stringify(selectors);
  if (flat.includes('REQUIRES_VERIFICATION')) {
    throw new Error(
      'config/selectors.json に未検証(REQUIRES_VERIFICATION)のセレクタが残っています。' +
      '実際のサロンボード画面で要素を確認し、値を埋めてから実行してください。詳細はREADME.mdを参照。'
    );
  }
}
