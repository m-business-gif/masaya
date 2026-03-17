// ==================== Data Layer ====================

const DB_KEY = 'inventory_products';
const HISTORY_KEY = 'inventory_history';

function loadProducts() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) || []; }
  catch { return []; }
}

function saveProducts(products) {
  localStorage.setItem(DB_KEY, JSON.stringify(products));
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addHistory(productId, productName, type, amount, afterStock, note = '') {
  const history = loadHistory();
  history.unshift({
    id: Date.now(),
    productId,
    productName,
    type,
    amount,
    afterStock,
    note,
    date: new Date().toISOString()
  });
  saveHistory(history);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ==================== UI Helpers ====================

function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function formatCurrency(n) {
  return '¥' + Number(n).toLocaleString('ja-JP');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// ==================== Navigation ====================

const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');

function showView(name) {
  views.forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'dashboard') renderDashboard();
  if (name === 'inventory') renderInventory();
  if (name === 'history') renderHistory();
  if (name === 'add') showAddForm();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ==================== Dashboard ====================

function renderDashboard() {
  const products = loadProducts();

  document.getElementById('stat-total').textContent = products.length;
  const totalStock = products.reduce((s, p) => s + p.quantity, 0);
  document.getElementById('stat-stock').textContent = totalStock;

  const lowItems = products.filter(p => p.quantity <= p.minStock);
  document.getElementById('stat-low').textContent = lowItems.length;

  const totalValue = products.reduce((s, p) => s + p.quantity * p.price, 0);
  document.getElementById('stat-value').textContent = formatCurrency(totalValue);

  // Low stock list
  const list = document.getElementById('low-stock-list');
  if (lowItems.length === 0) {
    list.innerHTML = '<div class="no-alert">在庫不足の商品はありません</div>';
  } else {
    list.innerHTML = lowItems.map(p => `
      <div class="alert-item">
        <span class="alert-badge">在庫不足</span>
        <span class="alert-name">${escHtml(p.name)}</span>
        <span class="alert-stock">${p.quantity}${escHtml(p.unit || '')}</span>
        <span style="color:var(--text-muted);font-size:0.8rem">下限: ${p.minStock}</span>
      </div>
    `).join('');
  }

  // Category summary
  const cats = {};
  products.forEach(p => {
    const c = p.category || '未分類';
    if (!cats[c]) cats[c] = { count: 0, stock: 0 };
    cats[c].count++;
    cats[c].stock += p.quantity;
  });
  const catGrid = document.getElementById('category-summary');
  catGrid.innerHTML = Object.entries(cats).map(([cat, data]) => `
    <div class="category-card">
      <div class="cat-name">${escHtml(cat)}</div>
      <div class="cat-count">${data.count}種類</div>
      <div style="font-size:0.8rem;color:var(--text-muted)">計 ${data.stock}点</div>
    </div>
  `).join('') || '<div style="color:var(--text-muted)">商品がありません</div>';
}

// ==================== Inventory ====================

function getCategories(products) {
  return [...new Set(products.map(p => p.category).filter(Boolean))].sort();
}

function renderInventory() {
  const products = loadProducts();
  const search = document.getElementById('search-input').value.toLowerCase();
  const catFilter = document.getElementById('filter-category').value;
  const sort = document.getElementById('sort-select').value;

  // Update category filter options
  const cats = getCategories(products);
  const current = catFilter;
  const filterEl = document.getElementById('filter-category');
  filterEl.innerHTML = '<option value="">全カテゴリ</option>' +
    cats.map(c => `<option value="${escHtml(c)}" ${c === current ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

  let filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search) || (p.category || '').toLowerCase().includes(search);
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ja');
    if (sort === 'quantity-asc') return a.quantity - b.quantity;
    if (sort === 'quantity-desc') return b.quantity - a.quantity;
    if (sort === 'category') return (a.category || '').localeCompare(b.category || '', 'ja');
    return 0;
  });

  const tbody = document.getElementById('inventory-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">商品が見つかりません</div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isLow = p.quantity <= p.minStock;
    return `
    <tr data-id="${p.id}">
      <td><strong>${escHtml(p.name)}</strong>${p.note ? `<br><small style="color:var(--text-muted)">${escHtml(p.note)}</small>` : ''}</td>
      <td><span style="background:#f1f5f9;padding:2px 8px;border-radius:999px;font-size:0.8rem">${escHtml(p.category || '未分類')}</span></td>
      <td class="quantity-cell ${isLow ? 'low' : 'ok'}">${p.quantity}${escHtml(p.unit || '')}</td>
      <td>${escHtml(p.unit || '-')}</td>
      <td>${formatCurrency(p.price)}</td>
      <td>${p.minStock}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-in" onclick="openStockModal('${p.id}', 'in')">入庫</button>
          <button class="btn-sm btn-out" onclick="openStockModal('${p.id}', 'out')">出庫</button>
          <button class="btn-sm btn-edit" onclick="editProduct('${p.id}')">編集</button>
          <button class="btn-sm btn-delete" onclick="deleteProduct('${p.id}')">削除</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

document.getElementById('search-input').addEventListener('input', renderInventory);
document.getElementById('filter-category').addEventListener('change', renderInventory);
document.getElementById('sort-select').addEventListener('change', renderInventory);

// ==================== Product Form ====================

function showAddForm(product = null) {
  document.getElementById('form-title').textContent = product ? '商品編集' : '商品追加';
  document.getElementById('edit-id').value = product ? product.id : '';
  document.getElementById('f-name').value = product ? product.name : '';
  document.getElementById('f-category').value = product ? product.category : '';
  document.getElementById('f-quantity').value = product ? product.quantity : 0;
  document.getElementById('f-unit').value = product ? (product.unit || '') : '';
  document.getElementById('f-price').value = product ? product.price : 0;
  document.getElementById('f-min').value = product ? product.minStock : 5;
  document.getElementById('f-note').value = product ? (product.note || '') : '';

  // Update category datalist
  const products = loadProducts();
  const cats = getCategories(products);
  document.getElementById('category-list').innerHTML =
    cats.map(c => `<option value="${escHtml(c)}">`).join('');
}

document.getElementById('product-form').addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const name = document.getElementById('f-name').value.trim();
  const category = document.getElementById('f-category').value.trim();
  const quantity = parseInt(document.getElementById('f-quantity').value) || 0;
  const unit = document.getElementById('f-unit').value.trim();
  const price = parseFloat(document.getElementById('f-price').value) || 0;
  const minStock = parseInt(document.getElementById('f-min').value) || 0;
  const note = document.getElementById('f-note').value.trim();

  const products = loadProducts();

  if (id) {
    // Edit
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      const old = products[idx];
      const diff = quantity - old.quantity;
      products[idx] = { ...old, name, category, quantity, unit, price, minStock, note };
      saveProducts(products);
      if (diff !== 0) addHistory(id, name, 'adjust', Math.abs(diff), quantity, '編集による調整');
      toast('商品を更新しました');
    }
  } else {
    // Add
    const newProduct = { id: generateId(), name, category, quantity, unit, price, minStock, note };
    products.push(newProduct);
    saveProducts(products);
    if (quantity > 0) addHistory(newProduct.id, name, 'in', quantity, quantity, '初期登録');
    toast('商品を追加しました');
  }

  showView('inventory');
});

document.getElementById('form-cancel').addEventListener('click', () => showView('inventory'));

function editProduct(id) {
  const product = loadProducts().find(p => p.id === id);
  if (!product) return;
  showAddForm(product);
  showView('add');
}

function deleteProduct(id) {
  if (!confirm('この商品を削除しますか？')) return;
  const products = loadProducts().filter(p => p.id !== id);
  saveProducts(products);
  renderInventory();
  renderDashboard();
  toast('商品を削除しました');
}

// ==================== Stock Modal ====================

function openStockModal(productId, type) {
  const product = loadProducts().find(p => p.id === productId);
  if (!product) return;

  document.getElementById('modal-product-id').value = productId;
  document.getElementById('modal-product-name').textContent = product.name;
  document.getElementById('modal-current-stock').textContent = product.quantity + (product.unit || '');
  document.getElementById('modal-type').value = type;
  document.getElementById('modal-amount').value = 1;
  document.getElementById('modal-note').value = '';
  updateModalLabel();

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function updateModalLabel() {
  const type = document.getElementById('modal-type').value;
  const labels = { in: '入庫数', out: '出庫数', adjust: '調整後在庫数' };
  document.getElementById('modal-amount-label').textContent = labels[type] || '数量';
  document.getElementById('modal-title').textContent = { in: '入庫', out: '出庫', adjust: '在庫調整' }[type];
}

document.getElementById('modal-type').addEventListener('change', updateModalLabel);

document.getElementById('modal-confirm').addEventListener('click', () => {
  const productId = document.getElementById('modal-product-id').value;
  const type = document.getElementById('modal-type').value;
  const amount = parseInt(document.getElementById('modal-amount').value);
  const note = document.getElementById('modal-note').value.trim();

  if (isNaN(amount) || amount < 0) {
    toast('数量を正しく入力してください', 'error');
    return;
  }

  const products = loadProducts();
  const idx = products.findIndex(p => p.id === productId);
  if (idx === -1) return;

  const product = products[idx];
  let newStock;

  if (type === 'in') {
    newStock = product.quantity + amount;
  } else if (type === 'out') {
    newStock = product.quantity - amount;
    if (newStock < 0) {
      toast('在庫数が不足しています', 'error');
      return;
    }
  } else {
    newStock = amount;
  }

  const diff = Math.abs(newStock - product.quantity);
  products[idx].quantity = newStock;
  saveProducts(products);

  addHistory(productId, product.name, type, diff, newStock, note);

  document.getElementById('modal-overlay').classList.add('hidden');
  renderInventory();
  renderDashboard();
  toast(`在庫を更新しました（現在: ${newStock}${product.unit || ''}）`);
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
});

// ==================== History ====================

function renderHistory() {
  const history = loadHistory();
  const products = loadProducts();
  const filter = document.getElementById('history-filter').value;

  // Update product filter
  const currentFilter = filter;
  const filterEl = document.getElementById('history-filter');
  filterEl.innerHTML = '<option value="">全商品</option>' +
    products.map(p => `<option value="${p.id}" ${p.id === currentFilter ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('');

  const filtered = filter ? history.filter(h => h.productId === filter) : history;
  const tbody = document.getElementById('history-tbody');

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">履歴がありません</div></td></tr>`;
    return;
  }

  const typeLabel = { in: '入庫', out: '出庫', adjust: '調整' };
  const typeColor = { in: 'var(--success)', out: 'var(--danger)', adjust: 'var(--warning)' };

  tbody.innerHTML = filtered.map(h => `
    <tr>
      <td style="white-space:nowrap;font-size:0.85rem">${formatDate(h.date)}</td>
      <td>${escHtml(h.productName)}</td>
      <td><span style="color:${typeColor[h.type]};font-weight:600">${typeLabel[h.type] || h.type}</span></td>
      <td>${h.amount}</td>
      <td>${h.afterStock}</td>
      <td style="color:var(--text-muted)">${escHtml(h.note || '')}</td>
    </tr>
  `).join('');
}

document.getElementById('history-filter').addEventListener('change', renderHistory);

document.getElementById('clear-history').addEventListener('click', () => {
  if (!confirm('履歴をすべて削除しますか？')) return;
  saveHistory([]);
  renderHistory();
  toast('履歴を削除しました');
});

// ==================== XSS prevention ====================

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==================== Sample Data ====================

function loadSampleData() {
  const sample = [
    { id: generateId(), name: 'A4コピー用紙', category: '文具', quantity: 8, unit: '冊', price: 500, minStock: 10, note: '' },
    { id: generateId(), name: 'ボールペン(黒)', category: '文具', quantity: 45, unit: '本', price: 100, minStock: 20, note: '' },
    { id: generateId(), name: 'ホッチキス', category: '文具', quantity: 3, unit: '個', price: 800, minStock: 5, note: '' },
    { id: generateId(), name: 'ノートPC', category: 'IT機器', quantity: 12, unit: '台', price: 120000, minStock: 3, note: 'ThinkPad' },
    { id: generateId(), name: 'USBマウス', category: 'IT機器', quantity: 2, unit: '個', price: 2000, minStock: 5, note: '' },
    { id: generateId(), name: 'コーヒー豆', category: '飲料', quantity: 500, unit: 'g', price: 30, minStock: 100, note: '会議室用' },
    { id: generateId(), name: '緑茶ティーバッグ', category: '飲料', quantity: 90, unit: '個', price: 20, minStock: 30, note: '' },
  ];
  saveProducts(sample);
}

// ==================== Init ====================

(function init() {
  if (loadProducts().length === 0) loadSampleData();
  renderDashboard();
})();
