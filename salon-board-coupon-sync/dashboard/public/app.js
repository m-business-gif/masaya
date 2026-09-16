const yen = (n) => `¥${Math.round(n || 0).toLocaleString('ja-JP')}`;
const pctText = (n) => (n === null || n === undefined ? '-' : `${n > 0 ? '+' : ''}${n}%`);

let dashboardData = null;
const renderedViews = new Set();

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

function showView(view) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (dashboardData && !renderedViews.has(view)) {
    renderView(view);
    renderedViews.add(view);
  }
}

function renderView(view) {
  if (view === 'summary') renderSummary(dashboardData);
  if (view === 'staff') renderStaff(dashboardData);
  if (view === 'menu') renderMenu(dashboardData);
  if (view === 'products') renderProducts(dashboardData);
  if (view === 'traffic') renderTraffic(dashboardData);
}

async function load() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    dashboardData = data;

    const freshness = document.getElementById('data-freshness');
    if (data.dataGeneratedAt) {
      freshness.textContent = `データ取得: ${new Date(data.dataGeneratedAt).toLocaleString('ja-JP')}`;
    }

    renderView('summary');
    renderedViews.add('summary');
  } catch (err) {
    const banner = document.getElementById('error-banner');
    banner.textContent = err.message;
    banner.classList.remove('hidden');
  }
}

function renderSummary(data) {
  const { total, salons, alerts } = data.summary;

  document.getElementById('stat-total-sales').textContent = yen(total.sales);
  const momEl = document.getElementById('stat-mom-sales');
  momEl.textContent = total.momSalesPct === null ? '前月データなし' : `前月比 ${pctText(total.momSalesPct)}`;
  momEl.className = `stat-sub ${total.momSalesPct > 0 ? 'up' : total.momSalesPct < 0 ? 'down' : ''}`;

  const today = new Date();
  const isMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() === today.getDate();
  document.getElementById('stat-period-note').textContent = isMonthEnd
    ? ''
    : `${data.period.thisMonth}は月の途中までの実績（前月比は月末実績と単純比較のため参考値）`;

  document.getElementById('stat-total-customers').textContent = `${total.customers.toLocaleString('ja-JP')}人`;
  document.getElementById('stat-avg-spend').textContent = yen(total.avgSpend);
  document.getElementById('stat-alert-count').textContent = alerts.length;

  const alertList = document.getElementById('alert-list');
  alertList.innerHTML = alerts.length
    ? alerts.map((a) => `<div class="alert-item">⚠️ ${a}</div>`).join('')
    : '<div class="no-alert">アラートはありません</div>';

  const tbody = document.getElementById('salon-table-body');
  tbody.innerHTML = salons.map((s) => `
    <tr>
      <td>${s.salon}</td>
      <td>${yen(s.sales)}</td>
      <td>${pctText(s.momSalesPct)}</td>
      <td>${s.customers.toLocaleString('ja-JP')}人</td>
      <td>${yen(s.avgSpend)}</td>
      <td>${s.targetAchievementPct === null ? '目標未設定' : `${s.targetAchievementPct}%`}</td>
    </tr>
  `).join('');
}

function chartUnavailableNotice(canvasId) {
  const canvas = document.getElementById(canvasId);
  const notice = document.createElement('p');
  notice.className = 'chart-unavailable';
  notice.textContent = 'グラフ描画ライブラリ（Chart.js、CDN配信）を読み込めませんでした。インターネット接続を確認してください。表データは下記の一覧をご覧ください。';
  canvas.replaceWith(notice);
}

function barChart(canvasId, labels, values, label) {
  if (typeof Chart === 'undefined') return chartUnavailableNotice(canvasId);
  return new Chart(document.getElementById(canvasId), {
    type: 'bar',
    data: { labels, datasets: [{ label, data: values, backgroundColor: '#2563eb' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });
}

function doughnutChart(canvasId, labels, values) {
  if (typeof Chart === 'undefined') return chartUnavailableNotice(canvasId);
  const palette = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
  return new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_, i) => palette[i % palette.length]) }] },
  });
}

function renderStaff(data) {
  const { ranking, optionRate, productRate } = data.staff;
  barChart('chart-staff-ranking', ranking.map((r) => r.staff), ranking.map((r) => r.sales), '売上');
  barChart('chart-option-rate', optionRate.map((r) => r.staff), optionRate.map((r) => r.rate), 'オプション売上率(%)');
  barChart('chart-product-rate', productRate.map((r) => r.staff), productRate.map((r) => r.rate), '物販売上率(%)');
}

function fillTable(bodyId, rows) {
  document.getElementById(bodyId).innerHTML = rows
    .map((r) => `<tr><td>${r.name}</td><td>${yen(r.sales)}</td><td>${r.count}</td></tr>`)
    .join('') || `<tr><td colspan="3">データなし</td></tr>`;
}

function renderMenu(data) {
  const { byMenu, byCoupon, optionStatus } = data.menu;
  doughnutChart('chart-menu', byMenu.map((m) => m.name), byMenu.map((m) => m.sales));
  barChart('chart-coupon', byCoupon.map((c) => c.name), byCoupon.map((c) => c.sales), '売上');
  fillTable('option-table-body', optionStatus);
}

function renderProducts(data) {
  const { byProduct, ticketBooks, serumBreakdown } = data.products;
  barChart('chart-products', byProduct.map((p) => p.name), byProduct.map((p) => p.sales), '売上');
  fillTable('ticket-table-body', ticketBooks);
  fillTable('serum-table-body', serumBreakdown);
}

function renderTraffic(data) {
  const { newVsReturning, byRoute, hourlyUtilization, staffVisitCounts } = data.traffic;

  if (typeof Chart === 'undefined') {
    chartUnavailableNotice('chart-new-returning');
  } else {
    new Chart(document.getElementById('chart-new-returning'), {
      type: 'line',
      data: {
        labels: newVsReturning.map((d) => d.date),
        datasets: [
          { label: '新規', data: newVsReturning.map((d) => d.new), borderColor: '#2563eb', backgroundColor: '#2563eb', tension: 0.2 },
          { label: '再来', data: newVsReturning.map((d) => d.returning), borderColor: '#16a34a', backgroundColor: '#16a34a', tension: 0.2 },
        ],
      },
    });
  }

  doughnutChart('chart-route', byRoute.map((r) => r.name), byRoute.map((r) => r.count));
  barChart('chart-hourly', hourlyUtilization.map((h) => h.hour), hourlyUtilization.map((h) => h.count), '来店数');

  document.getElementById('staff-visits-table-body').innerHTML = staffVisitCounts
    .map((s) => `<tr><td>${s.name}</td><td>${s.count}</td></tr>`)
    .join('') || '<tr><td colspan="2">データなし</td></tr>';
}

load();
