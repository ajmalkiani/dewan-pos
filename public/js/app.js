// Dewan Mobile POS - Core Application JavaScript

// Global App State
const state = {
  token: localStorage.getItem('dewan_token') || null,
  user: JSON.parse(localStorage.getItem('dewan_user') || 'null'),
  currentTab: 'dashboard',
  shopSettings: null,
  networkInfo: null,
  posCart: [],
  selectedPaymentMethod: 'Cash',
  selectedKhataCustomer: null,
  posCategory: 'All',
  posSearchQuery: '',
  allPosItems: [],
  currentRepairTicket: null
};

// API Helper with automatic JWT header
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(endpoint, { credentials: 'omit', ...options, headers });
    const data = await res.json().catch(() => ({}));
    
    if (res.status === 401 && !endpoint.startsWith('/api/auth/') && !endpoint.startsWith('/api/system/network-info')) {
      // Unauthorized or session expired
      logout();
      showToast('Session expired, please log in again', 'error');
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      throw new Error(data.error || 'Unable to connect to server');
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// Global password visibility toggle
function togglePasswordVisibility(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isPass ? 'fa-solid fa-eye-slash text-xs' : 'fa-solid fa-eye text-xs';
    }
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-800';
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';

  toast.className = `${bg} text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto`;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Play Sound Beep
function playBeep() {
  try {
    const audio = document.getElementById('beepAudio');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch (e) {}
}

// ==================== AUTHENTICATION ====================

function clearLoginFields() {
  const adminUserInput = document.getElementById('adminUsername');
  const adminPassInput = document.getElementById('adminPassword');
  const salesmanPinInput = document.getElementById('salesmanPin');
  if (adminUserInput) adminUserInput.value = '';
  if (adminPassInput) adminPassInput.value = '';
  if (salesmanPinInput) salesmanPinInput.value = '';
}

function switchLoginTab(tab) {
  const adminBtn = document.getElementById('tabAdminLogin');
  const salesBtn = document.getElementById('tabSalesmanLogin');
  const adminForm = document.getElementById('formAdminLogin');
  const salesForm = document.getElementById('formSalesmanLogin');
  const errBox = document.getElementById('loginError');

  errBox.classList.add('hidden');
  clearLoginFields();

  if (tab === 'admin') {
    adminBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-emerald-600 text-emerald-600 flex items-center justify-center gap-2';
    salesBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-2';
    adminForm.classList.remove('hidden');
    salesForm.classList.add('hidden');
  } else {
    salesBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-teal-600 text-teal-600 flex items-center justify-center gap-2';
    adminBtn.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-2';
    salesForm.classList.remove('hidden');
    adminForm.classList.add('hidden');
    loadSalesmenDropdown();
  }
}

async function loadSalesmenDropdown() {
  try {
    const data = await api('/api/auth/salesmen-list');
    const select = document.getElementById('salesmanSelect');
    select.innerHTML = '<option value="">Select salesman...</option>';
    data.salesmen.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.fullName} (${s.username})`;
      select.appendChild(opt);
    });
  } catch (err) {}
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value;
  const btn = document.getElementById('btnAdminSubmit');
  const errBox = document.getElementById('loginError');
  const errMsg = document.getElementById('loginErrorMsg');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Please wait...';

  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    onLoginSuccess(res);
  } catch (err) {
    errBox.classList.remove('hidden');
    errMsg.textContent = err.message || 'Login failed';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Log In</span><i class="fa-solid fa-arrow-right"></i>';
  }
}

async function handleSalesmanLogin(e) {
  e.preventDefault();
  const userId = document.getElementById('salesmanSelect').value;
  const pin = document.getElementById('salesmanPin').value.trim();
  const btn = document.getElementById('btnSalesmanSubmit');
  const errBox = document.getElementById('loginError');
  const errMsg = document.getElementById('loginErrorMsg');

  if (!userId) {
    errBox.classList.remove('hidden');
    errMsg.textContent = 'Please select a salesman';
    return;
  }
  if (!pin) {
    errBox.classList.remove('hidden');
    errMsg.textContent = 'Please enter 4-digit PIN';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

  try {
    const res = await api('/api/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({ userId, pin })
    });

    onLoginSuccess(res);
  } catch (err) {
    errBox.classList.remove('hidden');
    errMsg.textContent = err.message || 'Incorrect PIN';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Counter Log In</span><i class="fa-solid fa-arrow-right"></i>';
  }
}

function onLoginSuccess(res) {
  state.token = res.token;
  state.user = res.user;
  localStorage.setItem('dewan_token', res.token);
  localStorage.setItem('dewan_user', JSON.stringify(res.user));

  showToast(`Welcome, ${res.user.fullName}!`, 'success');
  initAuthenticatedApp();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('dewan_token');
  localStorage.removeItem('dewan_user');

  clearLoginFields();
  document.getElementById('appContainer').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  switchLoginTab('admin');
}

// Helper to check if current logged in user has a granular RBAC permission
function hasPerm(path) {
  if (!state.user) return false;
  if (state.user.role === 'admin') return true;
  const perms = state.user.permissions;
  if (!perms) return false;
  const parts = path.split('.');
  let curr = perms;
  for (const part of parts) {
    if (curr && curr[part] !== undefined) {
      curr = curr[part];
    } else {
      return false;
    }
  }
  return Boolean(curr);
}
window.hasPerm = hasPerm;

function applyRolePermissions() {
  const isAdmin = state.user && state.user.role === 'admin';
  const roleBadge = document.getElementById('roleBadge');
  const topUserName = document.getElementById('topUserName');
  const quickCashDrawer = document.getElementById('quickCashDrawer');

  topUserName.textContent = state.user ? state.user.fullName : 'Guest';

  if (isAdmin) {
    roleBadge.textContent = 'Admin / Owner';
    roleBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
    // Show all admin sections
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  } else {
    roleBadge.textContent = 'Staff User';
    roleBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800';
    // Hide strict admin sections
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }

  // Quick cash drawer: admin or staff with banking.balances
  if (quickCashDrawer) {
    if (isAdmin || hasPerm('banking.balances')) {
      quickCashDrawer.classList.remove('hidden');
      quickCashDrawer.classList.add('flex');
    } else {
      quickCashDrawer.classList.add('hidden');
      quickCashDrawer.classList.remove('flex');
    }
  }

  // Desktop Navigation Tab Visibility based on RBAC Permissions
  const navPos = document.getElementById('nav-pos');
  const navItems = document.getElementById('nav-items');
  const navRepairs = document.getElementById('nav-repairs');
  const navBanking = document.getElementById('nav-banking');
  const navReports = document.getElementById('nav-reports');
  const navExpenses = document.getElementById('nav-expenses');
  const navKhata = document.getElementById('nav-khata');
  const navUsers = document.getElementById('nav-users');
  const navSettings = document.getElementById('nav-settings');

  if (navPos) navPos.classList.toggle('hidden', !isAdmin && !hasPerm('pos.create'));
  if (navItems) navItems.classList.toggle('hidden', !isAdmin && !hasPerm('inventory.view'));
  if (navRepairs) navRepairs.classList.toggle('hidden', !isAdmin && !hasPerm('repairs.add') && !hasPerm('repairs.updateStatus') && !hasPerm('repairs.delete'));
  if (navBanking) navBanking.classList.toggle('hidden', !isAdmin && !hasPerm('banking.entry') && !hasPerm('banking.balances'));
  if (navReports) navReports.classList.toggle('hidden', !isAdmin && !hasPerm('reports.view'));
  if (navExpenses) navExpenses.classList.toggle('hidden', !isAdmin && !hasPerm('expensesKhata.add') && !hasPerm('expensesKhata.editDelete'));
  if (navKhata) navKhata.classList.toggle('hidden', !isAdmin && !hasPerm('expensesKhata.viewKhata'));
  if (navUsers) navUsers.classList.toggle('hidden', !isAdmin);
  if (navSettings) navSettings.classList.toggle('hidden', !isAdmin);

  // Mobile Navigation Items Visibility
  const mobileMenu = document.getElementById('mobileNavMenu');
  if (mobileMenu) {
    const mButtons = mobileMenu.querySelectorAll('button');
    mButtons.forEach(btn => {
      const onclickAttr = btn.getAttribute('onclick') || '';
      if (onclickAttr.includes("'pos'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('pos.create'));
      else if (onclickAttr.includes("'items'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('inventory.view'));
      else if (onclickAttr.includes("'repairs'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('repairs.add') && !hasPerm('repairs.updateStatus') && !hasPerm('repairs.delete'));
      else if (onclickAttr.includes("'banking'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('banking.entry') && !hasPerm('banking.balances'));
      else if (onclickAttr.includes("'reports'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('reports.view'));
      else if (onclickAttr.includes("'expenses'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('expensesKhata.add') && !hasPerm('expensesKhata.editDelete'));
      else if (onclickAttr.includes("'khata'")) btn.classList.toggle('hidden', !isAdmin && !hasPerm('expensesKhata.viewKhata'));
      else if (onclickAttr.includes("'users'")) btn.classList.toggle('hidden', !isAdmin);
      else if (onclickAttr.includes("'settings'")) btn.classList.toggle('hidden', !isAdmin);
    });
  }

  // Dashboard Profit Cards
  const profitCard = document.getElementById('cardDashboardTodayProfit');
  if (profitCard) {
    profitCard.classList.toggle('hidden', !isAdmin && !hasPerm('reports.view'));
  }

  // Inventory Granular Controls Visibility
  const canManageInv = isAdmin || hasPerm('inventory.manage');
  const canDeleteInv = isAdmin || hasPerm('inventory.delete');
  const btnAddNewItem = document.getElementById('btnAddNewItem');
  if (btnAddNewItem) btnAddNewItem.classList.toggle('hidden', !canManageInv);
  const btnEditCat = document.getElementById('btnEditCategory');
  if (btnEditCat) btnEditCat.classList.toggle('hidden', !canManageInv);
  const btnNewCat = document.getElementById('btnNewCategory');
  if (btnNewCat) btnNewCat.classList.toggle('hidden', !canManageInv);
  const thItemsAction = document.getElementById('thItemsAction');
  if (thItemsAction) thItemsAction.classList.toggle('hidden', !canManageInv && !canDeleteInv);

  // Repairs Granular Controls Visibility
  const canAddRepair = isAdmin || hasPerm('repairs.add');
  const btnNewRepair = document.getElementById('btnNewRepairTicket');
  if (btnNewRepair) btnNewRepair.classList.toggle('hidden', !canAddRepair);

  // Banking Granular Controls Visibility
  const canViewBalances = isAdmin || hasPerm('banking.balances');
  const canEntryBanking = isAdmin || hasPerm('banking.entry');
  const secBankingBalances = document.getElementById('secBankingBalancesCards');
  if (secBankingBalances) secBankingBalances.classList.toggle('hidden', !canViewBalances);
  const btnSubmitBankingTx = document.getElementById('btnSubmitBankingTx');
  if (btnSubmitBankingTx) {
    if (!canEntryBanking) {
      btnSubmitBankingTx.disabled = true;
      btnSubmitBankingTx.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
      btnSubmitBankingTx.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      btnSubmitBankingTx.title = 'Entry disabled: Staff permission required (Entry Only)';
    } else {
      btnSubmitBankingTx.disabled = false;
      btnSubmitBankingTx.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
      btnSubmitBankingTx.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
      btnSubmitBankingTx.removeAttribute('title');
    }
  }

  // Khata Granular Controls Visibility
  const canAddKhata = isAdmin || hasPerm('expensesKhata.add');
  const btnKhataNewCreditSale = document.getElementById('btnKhataNewCreditSale');
  if (btnKhataNewCreditSale) btnKhataNewCreditSale.classList.toggle('hidden', !canAddKhata);
  const btnKhataAddCust = document.getElementById('btnKhataAddCustomer');
  if (btnKhataAddCust) btnKhataAddCust.classList.toggle('hidden', !canAddKhata);
}

async function initAuthenticatedApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appContainer').classList.remove('hidden');

  applyRolePermissions();
  loadNetworkInfo();
  loadShopSettings();
  if (typeof loadCategories === 'function') loadCategories();
  loadDashboardData();

  // Smart initial tab based on assigned staff permissions
  if (state.user.role === 'admin') {
    switchTab('dashboard');
  } else if (hasPerm('pos.create')) {
    switchTab('pos');
  } else if (hasPerm('repairs.add') || hasPerm('repairs.updateStatus')) {
    switchTab('repairs');
  } else if (hasPerm('inventory.view')) {
    switchTab('items');
  } else if (hasPerm('banking.entry')) {
    switchTab('banking');
  } else if (hasPerm('expensesKhata.viewKhata')) {
    switchTab('khata');
  } else {
    switchTab('dashboard');
  }
}

// Tab Switching with RBAC Enforcements
function switchTab(tabId) {
  const isAdmin = state.user && state.user.role === 'admin';

  // Permission checks before switching
  if (tabId === 'pos' && !isAdmin && !hasPerm('pos.create')) {
    showToast('Access denied: POS Register is restricted for your account.', 'error');
    return;
  }
  if (tabId === 'items' && !isAdmin && !hasPerm('inventory.view')) {
    showToast('Access denied: Inventory & Stock view is restricted.', 'error');
    return;
  }
  if (tabId === 'repairs' && !isAdmin && !hasPerm('repairs.add') && !hasPerm('repairs.updateStatus') && !hasPerm('repairs.delete')) {
    showToast('Access denied: Mobile Repairs access is restricted.', 'error');
    return;
  }
  if (tabId === 'banking' && !isAdmin && !hasPerm('banking.entry') && !hasPerm('banking.balances')) {
    showToast('Access denied: Banking & Easyload is restricted.', 'error');
    return;
  }
  if (tabId === 'reports' && !isAdmin && !hasPerm('reports.view')) {
    showToast('Access denied: Reports & Profit access is restricted.', 'error');
    return;
  }
  if (tabId === 'expenses' && !isAdmin && !hasPerm('expensesKhata.add') && !hasPerm('expensesKhata.editDelete')) {
    showToast('Access denied: Shop Expenses is restricted.', 'error');
    return;
  }
  if (tabId === 'khata' && !isAdmin && !hasPerm('expensesKhata.viewKhata')) {
    showToast('Access denied: Credit Khata view is restricted.', 'error');
    return;
  }
  if ((tabId === 'users' || tabId === 'settings') && !isAdmin) {
    showToast('Access denied: This module is restricted to Administrators only.', 'error');
    return;
  }

  state.currentTab = tabId;

  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) activeNav.classList.add('active');

  // Update tab panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.add('hidden');
  });
  const activePane = document.getElementById(`tabContent-${tabId}`);
  if (activePane) activePane.classList.remove('hidden');

  // Close mobile menu if open
  document.getElementById('mobileNavMenu').classList.add('hidden');

  // Trigger tab data reload
  if (tabId === 'dashboard') loadDashboardData();
  else if (tabId === 'pos') initPosView();
  else if (tabId === 'items') loadItemsTable();
  else if (tabId === 'repairs') loadRepairsList();
  else if (tabId === 'banking') initBankingView();
  else if (tabId === 'reports') loadFinancialReport('today');
  else if (tabId === 'expenses') loadExpensesView();
  else if (tabId === 'khata') loadKhataList();
  else if (tabId === 'users') loadUsersList();
  else if (tabId === 'settings') populateSettingsForm();
}

function switchTabMobile(tabId) {
  switchTab(tabId);
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileNavMenu');
  menu.classList.toggle('hidden');
}

// Modal Handlers
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('hidden');
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('hidden');
}

// ==================== DASHBOARD DATA ====================

async function loadDashboardData() {
  try {
    const stats = await api('/api/reports/dashboard-stats');
    
    document.getElementById('statTodaySales').textContent = `Rs. ${stats.todaySalesTotal.toLocaleString()}`;
    document.getElementById('statTodaySalesCount').textContent = `${stats.todaySalesCount} invoices`;
    document.getElementById('statActiveRepairs').textContent = stats.activeRepairsCount;
    document.getElementById('statReadyRepairs').textContent = `${stats.readyRepairsCount} ready`;
    document.getElementById('statLowStock').textContent = stats.lowStockCount;
    document.getElementById('topDrawerCash').textContent = `Rs. ${stats.drawerCash.toLocaleString()}`;

    // Admin profit display
    if (state.user.role === 'admin' && stats.todayProfit !== undefined) {
      document.getElementById('statTodayProfit').textContent = `Rs. ${stats.todayProfit.toLocaleString()}`;
    }

    // Load recent sales
    const salesRes = await api('/api/pos/sales?limit=6');
    const recentSalesBody = document.getElementById('dashboardRecentSales');
    recentSalesBody.innerHTML = '';
    
    if (salesRes.sales.length === 0) {
      recentSalesBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">No sales recorded today</td></tr>';
    } else {
      salesRes.sales.forEach(s => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
          <td class="p-3 font-mono font-bold text-slate-700">${s.invoiceNo}</td>
          <td class="p-3 font-semibold text-slate-800">${s.customerName}</td>
          <td class="p-3 text-slate-500">${s.salesmanName}</td>
          <td class="p-3 font-bold text-emerald-700">Rs. ${s.totalAmount.toLocaleString()}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">${s.paymentMethod}</span></td>
        `;
        recentSalesBody.appendChild(tr);
      });
    }

    // Load recent repairs
    const repairsRes = await api('/api/repairs?status=InProgress');
    const recentRepairsBody = document.getElementById('dashboardRecentRepairs');
    recentRepairsBody.innerHTML = '';

    if (repairsRes.repairs.length === 0) {
      recentRepairsBody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">No devices currently under repair</td></tr>';
    } else {
      repairsRes.repairs.slice(0, 6).forEach(r => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
          <td class="p-3 font-mono font-bold text-amber-700">${r.ticketNo}</td>
          <td class="p-3 font-semibold text-slate-800">${r.deviceBrand} ${r.deviceModel}</td>
          <td class="p-3 text-slate-500 truncate max-w-[120px]">${r.faultDescription}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">In Progress</span></td>
          <td class="p-3 font-bold text-rose-600">Rs. ${r.remainingDue}</td>
        `;
        recentRepairsBody.appendChild(tr);
      });
    }

  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

// ==================== INTERACTIVE DASHBOARD DRILLDOWN MODALS ====================

// --- 1. TODAY'S SALES MODAL ---
let todaySalesData = [];
async function openTodaySalesModal() {
  openModal('modalTodaySalesDetails');
  const today = new Date().toISOString().split('T')[0];
  const dateBadge = document.getElementById('todaySalesDateBadge');
  if (dateBadge) dateBadge.textContent = `Today: ${today}`;

  const tbody = document.getElementById('todaySalesTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl text-emerald-600 mb-2 block"></i>Loading today\'s sales invoices...</td></tr>';
  
  try {
    const res = await api(`/api/pos/sales?date=${today}`);
    todaySalesData = res.sales || [];
    renderTodaySalesModal(todaySalesData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-500 font-semibold">${err.message || 'Failed to load sales'}</td></tr>`;
  }
}
window.openTodaySalesModal = openTodaySalesModal;

function renderTodaySalesModal(sales) {
  const totalRev = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalBills = sales.length;
  const cashTotal = sales.filter(s => s.paymentMethod === 'Cash').reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const digitalTotal = sales.filter(s => ['JazzCash', 'EasyPaisa', 'Bank'].includes(s.paymentMethod)).reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const udhaarTotal = sales.filter(s => s.paymentMethod === 'Udhaar').reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const elRev = document.getElementById('tsModalTotalRev');
  if (elRev) elRev.textContent = `Rs. ${totalRev.toLocaleString()}`;
  const elBills = document.getElementById('tsModalTotalBills');
  if (elBills) elBills.textContent = `${totalBills} Bills`;
  const elCash = document.getElementById('tsModalCash');
  if (elCash) elCash.textContent = `Rs. ${cashTotal.toLocaleString()}`;
  const elDig = document.getElementById('tsModalDigital');
  if (elDig) elDig.textContent = `Rs. ${digitalTotal.toLocaleString()}`;
  const elUdh = document.getElementById('tsModalUdhaar');
  if (elUdh) elUdh.textContent = `Rs. ${udhaarTotal.toLocaleString()}`;

  filterAndRenderTodaySalesTable();
}

function filterAndRenderTodaySalesTable() {
  const q = (document.getElementById('todaySalesSearch')?.value || '').toLowerCase().trim();
  const pmFilter = document.getElementById('todaySalesPmFilter')?.value || 'All';
  const tbody = document.getElementById('todaySalesTableBody');
  if (!tbody) return;

  const filtered = todaySalesData.filter(s => {
    const matchesPm = pmFilter === 'All' || s.paymentMethod === pmFilter;
    const matchesSearch = !q || 
      (s.invoiceNo && s.invoiceNo.toLowerCase().includes(q)) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.customerPhone && s.customerPhone.includes(q)) ||
      (s.salesmanName && s.salesmanName.toLowerCase().includes(q)) ||
      (s.items && s.items.some(it => it.name && it.name.toLowerCase().includes(q)));
    return matchesPm && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400 font-medium">No sales found matching your filter</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const itemsPreview = (s.items || []).map(it => `${it.name} (×${it.quantity})`).join(', ');
    const pmClass = s.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                    s.paymentMethod === 'Udhaar' ? 'bg-rose-100 text-rose-800' :
                    'bg-purple-100 text-purple-800';
    const timeStr = s.createdAt ? new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-3 font-mono font-bold text-slate-800 text-xs">${s.invoiceNo}</td>
        <td class="p-3 text-slate-500 text-xs whitespace-nowrap">${timeStr}</td>
        <td class="p-3 text-xs">
          <div class="font-semibold text-slate-800">${s.customerName || 'Walking Customer'}</div>
          ${s.customerPhone ? `<div class="text-[10px] text-slate-400 font-mono">${s.customerPhone}</div>` : ''}
        </td>
        <td class="p-3 text-xs font-medium text-slate-600">${s.salesmanName || '-'}</td>
        <td class="p-3 text-xs text-slate-600 max-w-[200px] truncate" title="${itemsPreview}">${itemsPreview || '-'}</td>
        <td class="p-3 text-xs font-bold text-emerald-700 whitespace-nowrap">Rs. ${(s.totalAmount || 0).toLocaleString()}</td>
        <td class="p-3 text-xs whitespace-nowrap"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${pmClass}">${s.paymentMethod}</span></td>
        <td class="p-3 text-xs text-right whitespace-nowrap">
          <div class="flex items-center justify-end gap-1.5 ml-auto">
            <button type="button" onclick="viewSaleReceipt('${s.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm">
              <i class="fa-solid fa-receipt"></i><span>Receipt</span>
            </button>
            ${(state.user?.role === 'admin' || hasPerm('pos.editDelete')) ? `
              <button type="button" onclick="deleteSaleInvoiceConfirm('${s.id}', '${s.invoiceNo}')" title="Cancel & Refund Invoice" class="p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition border border-transparent hover:border-rose-200">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}
window.filterAndRenderTodaySalesTable = filterAndRenderTodaySalesTable;

async function deleteSaleInvoiceConfirm(saleId, invoiceNo) {
  if (!confirm(`Are you sure you want to cancel and refund Invoice ${invoiceNo}? All items will be returned to inventory stock and drawer cash adjusted.`)) return;
  try {
    const res = await api(`/api/pos/sales/${saleId}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    if (document.getElementById('modalTodaySalesDetails') && !document.getElementById('modalTodaySalesDetails').classList.contains('hidden')) {
      openTodaySalesModal();
    }
    loadDashboardData();
    if (typeof loadPosCatalog === 'function') loadPosCatalog();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.deleteSaleInvoiceConfirm = deleteSaleInvoiceConfirm;

async function viewSaleReceipt(saleId) {
  try {
    const res = await api(`/api/pos/sales/${saleId}`);
    if (typeof renderPrintableReceipt === 'function') {
      renderPrintableReceipt(res.sale, res.shop);
      openModal('modalReceipt');
    }
  } catch (err) {
    showToast(err.message || 'Failed to load receipt', 'error');
  }
}
window.viewSaleReceipt = viewSaleReceipt;

// --- 2. TODAY'S NET PROFIT MODAL (ADMIN ONLY) ---
let todayProfitData = null;
async function openTodayProfitModal() {
  if (state.user?.role !== 'admin') {
    showToast('Only Administrator can view Net Profit details', 'error');
    return;
  }
  openModal('modalTodayProfitDetails');
  const content = document.getElementById('todayProfitModalBody');
  content.innerHTML = '<div class="p-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl text-teal-600 mb-2 block"></i>Calculating today\'s net profit breakdown...</div>';

  try {
    const data = await api('/api/reports/financial?range=today');
    todayProfitData = data;
    renderTodayProfitModal(data);
  } catch (err) {
    content.innerHTML = `<div class="p-8 text-center text-rose-500 font-semibold">${err.message || 'Failed to calculate profit'}</div>`;
  }
}
window.openTodayProfitModal = openTodayProfitModal;

function renderTodayProfitModal(data) {
  const summary = data.summary || {};
  const pos = data.pos || {};
  const repairs = data.repairs || {};
  const banking = data.banking || {};
  const expenses = data.expenses || {};

  const netProfit = summary.totalNetProfit || 0;
  const grossProfit = summary.totalGrossProfit || 0;
  const totalExp = expenses.totalExpenses || 0;

  const isPositive = netProfit >= 0;
  const bannerBg = isPositive ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-rose-600 to-amber-600';

  const expensesListHtml = (expenses.list || []).length === 0
    ? '<div class="p-6 text-center text-slate-400 text-xs">No expenses recorded for today</div>'
    : `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
          <tr>
            <th class="p-2.5">Category</th>
            <th class="p-2.5">Description</th>
            <th class="p-2.5">Paid By</th>
            <th class="p-2.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${(expenses.list || []).map(e => `
            <tr>
              <td class="p-2.5 font-semibold text-slate-700">${e.category}</td>
              <td class="p-2.5 text-slate-500">${e.description || '-'}</td>
              <td class="p-2.5 text-slate-500">${e.paidBy || 'Cash Drawer'}</td>
              <td class="p-2.5 text-right font-bold text-rose-600">- Rs. ${(e.amount || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  const categoryBreakdownEntries = Object.entries(pos.categoryBreakdown || {});
  const categoriesHtml = categoryBreakdownEntries.length === 0
    ? '<div class="p-6 text-center text-slate-400 text-xs">No POS items sold today</div>'
    : `
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-600 border-b border-slate-200">
          <tr>
            <th class="p-2.5">Category</th>
            <th class="p-2.5 text-center">Items Sold</th>
            <th class="p-2.5 text-right">Revenue</th>
            <th class="p-2.5 text-right">Gross Profit</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${categoryBreakdownEntries.map(([cat, val]) => `
            <tr>
              <td class="p-2.5 font-semibold text-slate-800">${cat}</td>
              <td class="p-2.5 text-center text-slate-600">${val.quantity} pcs</td>
              <td class="p-2.5 text-right font-mono text-slate-700">Rs. ${(val.salesAmount || 0).toLocaleString()}</td>
              <td class="p-2.5 text-right font-mono font-bold text-emerald-600">+ Rs. ${(val.profitAmount || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  const modalBody = document.getElementById('todayProfitModalBody');
  if (!modalBody) return;

  modalBody.innerHTML = `
    <!-- Top Highlight Banner -->
    <div class="${bannerBg} text-white p-5 rounded-xl shadow-md">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span class="text-xs uppercase tracking-wider text-emerald-100 font-semibold">Today's Net Profit (حتمی منافع)</span>
          <h2 class="text-2xl sm:text-3xl font-extrabold mt-0.5">Rs. ${netProfit.toLocaleString()}</h2>
          <p class="text-xs text-emerald-100 mt-1">Formula: Gross Profit (Rs. ${grossProfit.toLocaleString()}) − Expenses (Rs. ${totalExp.toLocaleString()})</p>
        </div>
        <div class="bg-white/15 backdrop-blur-sm px-4 py-2 rounded-lg text-right sm:text-center shrink-0">
          <div class="text-[11px] text-emerald-100">Margin Status</div>
          <div class="text-sm font-bold">${isPositive ? 'Profitable' : 'Deficit'}</div>
        </div>
      </div>
    </div>

    <!-- 4 Profit Stream Tiles -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
          <span>POS Margin</span>
          <i class="fa-solid fa-bag-shopping text-emerald-600"></i>
        </div>
        <div class="text-base sm:text-lg font-bold text-emerald-600">+ Rs. ${(pos.grossProfit || 0).toLocaleString()}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${pos.salesCount || 0} sales bills</div>
      </div>

      <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
          <span>Banking Margin</span>
          <i class="fa-solid fa-mobile-retro text-purple-600"></i>
        </div>
        <div class="text-base sm:text-lg font-bold text-purple-600">+ Rs. ${(banking.netProfit || 0).toLocaleString()}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${banking.txCount || 0} transactions</div>
      </div>

      <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div class="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
          <span>Repairs Profit</span>
          <i class="fa-solid fa-wrench text-blue-600"></i>
        </div>
        <div class="text-base sm:text-lg font-bold text-blue-600">+ Rs. ${(repairs.profit || 0).toLocaleString()}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${repairs.deliveredCount || 0} delivered</div>
      </div>

      <div class="bg-slate-50 p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
        <div class="flex items-center justify-between text-xs text-rose-700 font-semibold mb-1">
          <span>Deducted Expenses</span>
          <i class="fa-solid fa-arrow-trend-down text-rose-500"></i>
        </div>
        <div class="text-base sm:text-lg font-bold text-rose-600">- Rs. ${(expenses.totalExpenses || 0).toLocaleString()}</div>
        <div class="text-[10px] text-rose-500 mt-0.5">${expenses.expenseCount || 0} expenses</div>
      </div>
    </div>

    <!-- Tabs for Detailed Views -->
    <div class="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div class="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
        <button type="button" onclick="switchProfitModalTab('expenses')" id="profitTabBtn-expenses" class="flex-1 py-2.5 px-3 border-b-2 border-teal-600 text-teal-700 font-bold flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-receipt"></i><span>Today's Expenses (${expenses.expenseCount || 0})</span>
        </button>
        <button type="button" onclick="switchProfitModalTab('categories')" id="profitTabBtn-categories" class="flex-1 py-2.5 px-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-tags"></i><span>Category Margins</span>
        </button>
      </div>

      <div id="profitTabPane-expenses" class="p-1 max-h-56 overflow-y-auto">
        ${expensesListHtml}
      </div>

      <div id="profitTabPane-categories" class="p-1 max-h-56 overflow-y-auto hidden">
        ${categoriesHtml}
      </div>
    </div>
  `;
}

function switchProfitModalTab(tab) {
  const btnExp = document.getElementById('profitTabBtn-expenses');
  const btnCat = document.getElementById('profitTabBtn-categories');
  const paneExp = document.getElementById('profitTabPane-expenses');
  const paneCat = document.getElementById('profitTabPane-categories');

  if (!btnExp || !btnCat || !paneExp || !paneCat) return;

  if (tab === 'expenses') {
    btnExp.className = 'flex-1 py-2.5 px-3 border-b-2 border-teal-600 text-teal-700 font-bold flex items-center justify-center gap-1.5';
    btnCat.className = 'flex-1 py-2.5 px-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
    paneExp.classList.remove('hidden');
    paneCat.classList.add('hidden');
  } else {
    btnCat.className = 'flex-1 py-2.5 px-3 border-b-2 border-teal-600 text-teal-700 font-bold flex items-center justify-center gap-1.5';
    btnExp.className = 'flex-1 py-2.5 px-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
    paneCat.classList.remove('hidden');
    paneExp.classList.add('hidden');
  }
}
window.switchProfitModalTab = switchProfitModalTab;

// --- 3. UNDER REPAIR MODAL ---
let underRepairData = [];
async function openUnderRepairModal() {
  openModal('modalUnderRepairDetails');
  const tbody = document.getElementById('underRepairTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl text-amber-600 mb-2 block"></i>Loading workshop devices...</td></tr>';

  try {
    const res = await api('/api/repairs');
    const allRepairs = res.repairs || [];
    underRepairData = allRepairs.filter(r => ['Received', 'InProgress', 'Repaired'].includes(r.status));
    renderUnderRepairModal(underRepairData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-500 font-semibold">${err.message || 'Failed to load repairs'}</td></tr>`;
  }
}
window.openUnderRepairModal = openUnderRepairModal;

function renderUnderRepairModal(repairs) {
  const inProgressCount = repairs.filter(r => r.status === 'InProgress').length;
  const readyCount = repairs.filter(r => r.status === 'Repaired').length;
  const receivedCount = repairs.filter(r => r.status === 'Received').length;

  const elTotal = document.getElementById('urModalTotal');
  if (elTotal) elTotal.textContent = `${repairs.length} Devices`;
  const elInProg = document.getElementById('urModalInProgress');
  if (elInProg) elInProg.textContent = `${inProgressCount} Working`;
  const elReady = document.getElementById('urModalReady');
  if (elReady) elReady.textContent = `${readyCount} Ready`;
  const elRec = document.getElementById('urModalReceived');
  if (elRec) elRec.textContent = `${receivedCount} Waiting`;

  filterAndRenderUnderRepairTable();
}

let activeRepairFilterStatus = 'All';
function setRepairStatusFilter(status, btn) {
  activeRepairFilterStatus = status;
  document.querySelectorAll('.repair-filter-chip').forEach(b => {
    b.className = 'repair-filter-chip px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
  });
  if (btn) {
    btn.className = 'repair-filter-chip px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white shadow-sm transition';
  }
  filterAndRenderUnderRepairTable();
}
window.setRepairStatusFilter = setRepairStatusFilter;

function filterAndRenderUnderRepairTable() {
  const q = (document.getElementById('underRepairSearch')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('underRepairTableBody');
  if (!tbody) return;

  const filtered = underRepairData.filter(r => {
    const matchesStatus = activeRepairFilterStatus === 'All' || r.status === activeRepairFilterStatus;
    const desc = r.faultDescription || r.issueDescription || '';
    const matchesSearch = !q ||
      (r.ticketNo && r.ticketNo.toLowerCase().includes(q)) ||
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.customerPhone && r.customerPhone.includes(q)) ||
      (r.deviceBrand && r.deviceBrand.toLowerCase().includes(q)) ||
      (r.deviceModel && r.deviceModel.toLowerCase().includes(q)) ||
      desc.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-400 font-medium">No devices found matching filter</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const statusClass = r.status === 'Repaired' ? 'bg-emerald-100 text-emerald-800' :
                        r.status === 'InProgress' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800';
    const statusLabel = r.status === 'Repaired' ? 'Ready for Pickup' :
                        r.status === 'InProgress' ? 'In Progress' : 'Received / Queue';
    const fault = r.faultDescription || r.issueDescription || '-';
    const dateStr = r.createdAt ? r.createdAt.split('T')[0] : (r.date || '-');

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-3 font-mono font-bold text-amber-700 text-xs">${r.ticketNo}</td>
        <td class="p-3 text-xs">
          <div class="font-bold text-slate-800">${r.deviceBrand || ''} ${r.deviceModel || 'Phone'}</div>
          <div class="text-[10px] text-slate-400">Received: ${dateStr}</div>
        </td>
        <td class="p-3 text-xs">
          <div class="font-semibold text-slate-700">${r.customerName || 'Customer'}</div>
          ${r.customerPhone ? `<div class="text-[10px] text-slate-400 font-mono">${r.customerPhone}</div>` : ''}
        </td>
        <td class="p-3 text-xs text-slate-600 max-w-[200px] truncate" title="${fault}">${fault}</td>
        <td class="p-3 text-xs whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${statusLabel}</span>
        </td>
        <td class="p-3 text-xs whitespace-nowrap">
          <div class="font-bold text-slate-800">Rs. ${(r.estimatedCost || 0).toLocaleString()}</div>
          ${r.advancePaid ? `<div class="text-[10px] text-emerald-600 font-semibold">Adv: Rs. ${r.advancePaid.toLocaleString()}</div>` : ''}
        </td>
        <td class="p-3 text-xs text-slate-600 whitespace-nowrap">${r.technicianName || 'Workshop'}</td>
        <td class="p-3 text-xs text-right whitespace-nowrap">
          <button type="button" onclick="openRepairDetailFromCard('${r.id}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm ml-auto">
            <i class="fa-solid fa-folder-open"></i><span>Ticket</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}
window.filterAndRenderUnderRepairTable = filterAndRenderUnderRepairTable;

function openRepairDetailFromCard(repairId) {
  closeModal('modalUnderRepairDetails');
  switchTab('repairs');
  setTimeout(() => {
    if (typeof openRepairDetailModal === 'function') {
      openRepairDetailModal(repairId);
    }
  }, 100);
}
window.openRepairDetailFromCard = openRepairDetailFromCard;

// --- 4. LOW STOCK ALERT MODAL ---
let lowStockData = [];
async function openLowStockModal() {
  openModal('modalLowStockDetails');
  const tbody = document.getElementById('lowStockTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-xl text-rose-600 mb-2 block"></i>Checking low stock inventory items...</td></tr>';

  try {
    const res = await api('/api/items?lowStock=true');
    lowStockData = res.items || [];
    renderLowStockModal(lowStockData);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-500 font-semibold">${err.message || 'Failed to load stock data'}</td></tr>`;
  }
}
window.openLowStockModal = openLowStockModal;

function renderLowStockModal(items) {
  const outOfStockCount = items.filter(i => (i.stockQuantity || 0) <= 0).length;
  const criticalCount = items.filter(i => (i.stockQuantity || 0) > 0).length;
  const totalValuation = items.reduce((sum, i) => sum + ((i.stockQuantity || 0) * (i.salePrice || 0)), 0);

  const elCount = document.getElementById('lsModalTotalCount');
  if (elCount) elCount.textContent = `${items.length} Items`;
  const elOut = document.getElementById('lsModalOutOfStock');
  if (elOut) elOut.textContent = `${outOfStockCount} Out of Stock`;
  const elCrit = document.getElementById('lsModalCritical');
  if (elCrit) elCrit.textContent = `${criticalCount} Low Quantity`;
  const elVal = document.getElementById('lsModalValuation');
  if (elVal) elVal.textContent = `Rs. ${totalValuation.toLocaleString()}`;

  filterAndRenderLowStockTable();
}

let activeLowStockFilter = 'All';
function setLowStockFilter(filterType, btn) {
  activeLowStockFilter = filterType;
  document.querySelectorAll('.lowstock-filter-chip').forEach(b => {
    b.className = 'lowstock-filter-chip px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
  });
  if (btn) {
    btn.className = 'lowstock-filter-chip px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white shadow-sm transition';
  }
  filterAndRenderLowStockTable();
}
window.setLowStockFilter = setLowStockFilter;

function filterAndRenderLowStockTable() {
  const q = (document.getElementById('lowStockSearch')?.value || '').toLowerCase().trim();
  const tbody = document.getElementById('lowStockTableBody');
  if (!tbody) return;
  const isAdmin = state.user?.role === 'admin';

  const filtered = lowStockData.filter(i => {
    const isOut = (i.stockQuantity || 0) <= 0;
    const matchesFilter = activeLowStockFilter === 'All' ||
      (activeLowStockFilter === 'OutOfStock' && isOut) ||
      (activeLowStockFilter === 'Low' && !isOut);

    const matchesSearch = !q ||
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.urduName && i.urduName.includes(q)) ||
      (i.barcode && i.barcode.toLowerCase().includes(q)) ||
      (i.category && i.category.toLowerCase().includes(q)) ||
      (i.subCategory && i.subCategory.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400 font-medium">No items found matching filter</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(i => {
    const qty = i.stockQuantity || 0;
    const isOut = qty <= 0;
    const stockBadge = isOut 
      ? '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">0 Left (Out of Stock)</span>'
      : `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">${qty} Pcs Left</span>`;

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-3 text-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
              ${i.imageUrl ? `<img src="${i.imageUrl}" class="w-full h-full object-cover">` : '<i class="fa-solid fa-box text-xs"></i>'}
            </div>
            <div>
              <div class="font-bold text-slate-800">${i.name}</div>
              ${i.urduName ? `<div class="text-[11px] text-slate-500 font-urdu">${i.urduName}</div>` : ''}
              ${i.barcode ? `<div class="text-[10px] text-slate-400 font-mono">Barcode: ${i.barcode}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="p-3 text-xs">
          <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">${i.category}</span>
          ${i.subCategory ? `<div class="text-[10px] text-slate-400 mt-0.5">${i.subCategory}</div>` : ''}
        </td>
        <td class="p-3 text-xs text-center">${stockBadge}</td>
        <td class="p-3 text-xs text-center font-semibold text-slate-500">Min: ${i.minAlertQuantity || 3}</td>
        <td class="p-3 text-xs font-bold text-emerald-700 whitespace-nowrap">Rs. ${(i.salePrice || 0).toLocaleString()}</td>
        ${isAdmin ? `<td class="p-3 text-xs text-slate-500 font-mono whitespace-nowrap admin-only">Rs. ${(i.costPrice || 0).toLocaleString()}</td>` : ''}
        <td class="p-3 text-xs text-right whitespace-nowrap">
          <button type="button" onclick="openEditItemFromCard('${i.id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm ml-auto">
            <i class="fa-solid fa-pen-to-square"></i><span>Edit Stock</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}
window.filterAndRenderLowStockTable = filterAndRenderLowStockTable;

function openEditItemFromCard(itemId) {
  closeModal('modalLowStockDetails');
  switchTab('items');
  setTimeout(() => {
    if (typeof openEditItemModal === 'function') {
      openEditItemModal(itemId);
      openModal('modalItem');
    }
  }, 150);
}
window.openEditItemFromCard = openEditItemFromCard;

// ==================== SYSTEM & NETWORK CONNECT (ADMIN PROTECTED) ====================

function openMobileConnectModal() {
  const errBox = document.getElementById('connectAuthError');
  if (errBox) errBox.classList.add('hidden');
  const passInp = document.getElementById('connectAdminPassword');
  if (passInp) {
    passInp.value = '';
    passInp.type = 'password';
  }
  const unlockBtn = document.getElementById('btnUnlockConnect');
  if (unlockBtn) {
    unlockBtn.disabled = false;
    unlockBtn.innerHTML = '<i class="fa-solid fa-unlock"></i><span>Unlock QR</span>';
  }

  // Open the Admin Password Authentication Modal
  openModal('modalAdminMobileConnectAuth');
  setTimeout(() => {
    if (passInp) passInp.focus();
  }, 100);
}
window.openMobileConnectModal = openMobileConnectModal;

async function handleVerifyConnectPassword(e) {
  e.preventDefault();
  const passInput = document.getElementById('connectAdminPassword');
  const password = passInput ? passInput.value : '';
  const btn = document.getElementById('btnUnlockConnect');
  const errBox = document.getElementById('connectAuthError');
  const errMsg = document.getElementById('connectAuthErrorMsg');

  if (!password || !password.trim()) {
    if (errBox && errMsg) {
      errMsg.textContent = 'Please enter admin password or PIN';
      errBox.classList.remove('hidden');
    }
    return;
  }

  if (errBox) errBox.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';

  try {
    const res = await api('/api/system/network-info', {
      method: 'POST',
      body: JSON.stringify({ adminPassword: password.trim() })
    });

    state.networkInfo = res;
    if (res.qrCodeDataUrl) {
      document.getElementById('qrCodeImage').src = res.qrCodeDataUrl;
    }
    document.getElementById('qrServerUrl').textContent = res.serverUrl;

    closeModal('modalAdminMobileConnectAuth');
    if (passInput) passInput.value = '';
    openModal('modalMobileConnect');
    showToast('Admin authorized: Mobile Connect unlocked', 'success');
  } catch (err) {
    if (errBox && errMsg) {
      errMsg.textContent = err.message || 'Incorrect Admin password or PIN';
      errBox.classList.remove('hidden');
    }
    if (passInput) {
      passInput.value = '';
      passInput.focus();
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-unlock"></i><span>Unlock QR</span>';
  }
}
window.handleVerifyConnectPassword = handleVerifyConnectPassword;

function closeMobileConnectModal() {
  closeModal('modalMobileConnect');
  // Wipe QR code and server URL from DOM memory
  const qrImg = document.getElementById('qrCodeImage');
  if (qrImg) qrImg.src = '';
  const qrUrl = document.getElementById('qrServerUrl');
  if (qrUrl) qrUrl.textContent = 'http://...';
}
window.closeMobileConnectModal = closeMobileConnectModal;

async function loadShopSettings() {
  try {
    const res = await api('/api/system/settings');
    state.shopSettings = res.settings;
  } catch (e) {}
}

function populateSettingsForm() {
  if (!state.shopSettings) return;
  document.getElementById('setShopName').value = state.shopSettings.name || '';
  document.getElementById('setShopPhone').value = state.shopSettings.phone || '';
  document.getElementById('setShopTagline').value = state.shopSettings.tagline || '';
  document.getElementById('setShopAddress').value = state.shopSettings.address || '';
  document.getElementById('setShopFooterNote').value = state.shopSettings.footerNote || '';
}

async function saveShopSettings(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('setShopName').value,
    phone: document.getElementById('setShopPhone').value,
    tagline: document.getElementById('setShopTagline').value,
    address: document.getElementById('setShopAddress').value,
    footerNote: document.getElementById('setShopFooterNote').value
  };

  try {
    const res = await api('/api/system/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    state.shopSettings = res.settings;
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function createBackupPoint() {
  try {
    const res = await api('/api/system/create-backup-point', { method: 'POST' });
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Auto Initialize on window load
window.addEventListener('DOMContentLoaded', () => {
  clearLoginFields();
  if (state.token && state.user) {
    initAuthenticatedApp();
  } else {
    loadSalesmenDropdown();
  }
});

// Extra protection against browser bfcache / autofill when opening via QR scan
window.addEventListener('pageshow', () => {
  if (!state.token) {
    clearLoginFields();
  }
});
