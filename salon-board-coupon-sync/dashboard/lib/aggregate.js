function monthKeyOf(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function classify(row) {
  const category = row.category || '';
  const itemName = row.itemName || '';
  if (itemName.includes('回数券')) return 'ticketBook';
  if (category.includes('クーポン')) return 'coupon';
  if (category.includes('オプション')) return 'option';
  if (category.includes('店販') || category.includes('物販')) return 'product';
  return 'menu';
}

function sumBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const entry = map.get(key) || { name: key, sales: 0, count: 0 };
    entry.sales += row.amount || 0;
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.sales - a.sales);
}

/**
 * 明細行は1来店につき複数行（メニュー+オプション+店販など）に分かれるため、
 * 同一来店（日付・スタッフ・時刻が同じ）をキーにまとめて「客数」を数える。
 * お客様名までは取得していないため、あくまで来店実績ベースの近似値。
 */
function dedupeVisits(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.date}|${row.staff}|${row.time || ''}`;
    if (!map.has(key)) {
      map.set(key, {
        date: row.date,
        staff: row.staff,
        time: row.time,
        customerType: row.customerType,
        reservationRoute: row.reservationRoute,
        salon: row.salon,
      });
    }
  }
  return [...map.values()];
}

function buildSummary(thisRows, lastRows, targets) {
  const salonNames = [...new Set([...thisRows, ...lastRows].map((r) => r.salon))];
  const threshold = targets._lowPerformanceThresholdPct ?? 70;

  const salons = salonNames.map((salon) => {
    const thisSalonRows = thisRows.filter((r) => r.salon === salon);
    const lastSalonRows = lastRows.filter((r) => r.salon === salon);
    const sales = thisSalonRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    const prevMonthSales = lastSalonRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    const customers = dedupeVisits(thisSalonRows).length;
    const avgSpend = customers > 0 ? Math.round(sales / customers) : 0;
    const momSalesPct = prevMonthSales > 0 ? Math.round(((sales - prevMonthSales) / prevMonthSales) * 1000) / 10 : null;

    const target = targets[salon] ?? targets._default ?? 0;
    const targetAchievementPct = target > 0 ? Math.round((sales / target) * 1000) / 10 : null;
    const isLowPerformance = targetAchievementPct !== null && targetAchievementPct < threshold;

    return { salon, sales, prevMonthSales, momSalesPct, customers, avgSpend, target, targetAchievementPct, isLowPerformance };
  }).sort((a, b) => b.sales - a.sales);

  const totalSales = salons.reduce((sum, s) => sum + s.sales, 0);
  const totalPrevSales = salons.reduce((sum, s) => sum + s.prevMonthSales, 0);
  const totalCustomers = salons.reduce((sum, s) => sum + s.customers, 0);
  const totalMomSalesPct = totalPrevSales > 0 ? Math.round(((totalSales - totalPrevSales) / totalPrevSales) * 1000) / 10 : null;
  const totalAvgSpend = totalCustomers > 0 ? Math.round(totalSales / totalCustomers) : 0;

  const alerts = salons
    .filter((s) => s.isLowPerformance)
    .map((s) => `${s.salon}: 目標達成率${s.targetAchievementPct}%（目標未達、しきい値${threshold}%）`);

  return {
    salons,
    total: { sales: totalSales, prevMonthSales: totalPrevSales, momSalesPct: totalMomSalesPct, customers: totalCustomers, avgSpend: totalAvgSpend },
    alerts,
  };
}

function buildStaffAnalysis(rows) {
  const staffNames = [...new Set(rows.map((r) => r.staff).filter(Boolean))];

  const ranking = staffNames
    .map((staff) => {
      const staffRows = rows.filter((r) => r.staff === staff);
      const sales = staffRows.reduce((sum, r) => sum + (r.amount || 0), 0);
      const customers = dedupeVisits(staffRows).length;
      return { staff, sales, customers };
    })
    .sort((a, b) => b.sales - a.sales);

  function rateFor(kind) {
    return staffNames
      .map((staff) => {
        const staffRows = rows.filter((r) => r.staff === staff);
        const totalSales = staffRows.reduce((sum, r) => sum + (r.amount || 0), 0);
        const kindSales = staffRows.filter((r) => classify(r) === kind).reduce((sum, r) => sum + (r.amount || 0), 0);
        const rate = totalSales > 0 ? Math.round((kindSales / totalSales) * 1000) / 10 : 0;
        return { staff, [`${kind}Sales`]: kindSales, totalSales, rate };
      })
      .sort((a, b) => b.rate - a.rate);
  }

  return { ranking, optionRate: rateFor('option'), productRate: rateFor('product') };
}

function buildMenuAnalysis(rows) {
  return {
    byMenu: sumBy(rows.filter((r) => classify(r) === 'menu'), (r) => r.itemName),
    byCoupon: sumBy(rows.filter((r) => classify(r) === 'coupon'), (r) => r.itemName),
    optionStatus: sumBy(rows.filter((r) => classify(r) === 'option'), (r) => r.itemName),
  };
}

function buildProductAnalysis(rows) {
  const byProduct = sumBy(rows.filter((r) => classify(r) === 'product'), (r) => r.itemName);
  return {
    byProduct,
    ticketBooks: sumBy(rows.filter((r) => classify(r) === 'ticketBook'), (r) => r.itemName),
    serumBreakdown: byProduct.filter((p) => p.name.includes('美容液')),
  };
}

function buildTrafficAnalysis(rows) {
  const visits = dedupeVisits(rows);

  const byDate = new Map();
  for (const v of visits) {
    const entry = byDate.get(v.date) || { date: v.date, new: 0, returning: 0 };
    if (v.customerType === '新規') entry.new += 1;
    else if (v.customerType === '再来') entry.returning += 1;
    byDate.set(v.date, entry);
  }
  const newVsReturning = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const byRoute = sumCountBy(visits, (v) => v.reservationRoute);

  const hourlyMap = new Map();
  for (const v of visits) {
    const hour = (v.time || '').split(':')[0];
    if (!hour) continue;
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
  }
  const hourlyUtilization = [...hourlyMap.entries()]
    .map(([hour, count]) => ({ hour: `${hour}時`, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const staffVisitCounts = sumCountBy(visits, (v) => v.staff);

  return { newVsReturning, byRoute, hourlyUtilization, staffVisitCounts };
}

function sumCountBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export function computeDashboard(rows, targets, now = new Date()) {
  const thisMonthKey = monthKey(now);
  const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const thisRows = rows.filter((r) => monthKeyOf(r.date) === thisMonthKey);
  const lastRows = rows.filter((r) => monthKeyOf(r.date) === lastMonthKey);

  return {
    generatedAt: new Date().toISOString(),
    period: { thisMonth: thisMonthKey, lastMonth: lastMonthKey },
    summary: buildSummary(thisRows, lastRows, targets),
    staff: buildStaffAnalysis(thisRows),
    menu: buildMenuAnalysis(thisRows),
    products: buildProductAnalysis(thisRows),
    traffic: buildTrafficAnalysis(thisRows),
  };
}
