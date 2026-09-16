import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_FILE = path.join(DATA_DIR, 'sales-raw.json');

const SALONS = ['S原宿', 'S渋谷', 'S新宿'];
const STAFF = ['田中', '佐藤', '鈴木', '高橋', '伊藤'];
const MENUS = ['カット', 'カラー', 'パーマ', 'トリートメント', '縮毛矯正'];
const COUPONS = ['新規限定カット割', 'カラー+トリートメントセット', '平日限定パーマ割'];
const OPTIONS = ['ヘッドスパ', '眉カット', '前髪カット', '炭酸泉'];
const PRODUCTS = ['美容液A', '美容液B', 'シャンプー', 'トリートメント剤', 'スタイリング剤'];
const TICKET_BOOKS = ['トリートメント回数券(5回)', 'ヘッドスパ回数券(10回)'];
const ROUTES = ['ネット予約', '電話予約', 'フリー来店', '再来予約'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function randomTime() {
  return `${pad(randInt(10, 19))}:${pick(['00', '15', '30', '45'])}`;
}

function rowsForDate(date, salon) {
  const rows = [];
  const visits = randInt(15, 30);

  for (let i = 0; i < visits; i++) {
    const staff = pick(STAFF);
    const customerType = Math.random() < 0.35 ? '新規' : '再来';
    const reservationRoute = customerType === '新規' ? pick(['ネット予約', '電話予約', 'フリー来店']) : pick(ROUTES);
    const time = randomTime();

    const useCoupon = Math.random() < 0.3;
    rows.push({
      date,
      time,
      staff,
      category: useCoupon ? 'クーポン' : 'メニュー',
      itemName: useCoupon ? pick(COUPONS) : pick(MENUS),
      amount: useCoupon ? randInt(3000, 6000) : randInt(4000, 9000),
      customerType,
      reservationRoute,
      salon,
    });

    if (Math.random() < 0.4) {
      rows.push({
        date,
        time,
        staff,
        category: 'オプション',
        itemName: pick(OPTIONS),
        amount: randInt(1000, 3000),
        customerType,
        reservationRoute,
        salon,
      });
    }

    if (Math.random() < 0.5) {
      rows.push({
        date,
        time,
        staff,
        category: '店販',
        itemName: pick(PRODUCTS),
        amount: randInt(2000, 8000),
        customerType,
        reservationRoute,
        salon,
      });
    }

    if (Math.random() < 0.05) {
      rows.push({
        date,
        time,
        staff,
        category: '店販',
        itemName: pick(TICKET_BOOKS),
        amount: randInt(15000, 40000),
        customerType,
        reservationRoute,
        salon,
      });
    }
  }

  return rows;
}

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const now = new Date();
  const rows = [];

  for (const salon of SALONS) {
    for (let monthsAgo = 1; monthsAgo >= 0; monthsAgo--) {
      const from = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      const to = monthsAgo === 0 ? now : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);

      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        rows.push(...rowsForDate(isoDate(d), salon));
      }
    }
  }

  writeFileSync(OUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  console.log(`[mock] ${rows.length}件のダミー明細を ${OUT_FILE} に書き出しました`);
}

main();
