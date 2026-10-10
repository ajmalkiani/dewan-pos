// Dewan Mobile POS - Reports, Analytics, Expenses, Khata & Users Module

let currentReportPeriod = 'today';

// ==================== FINANCIAL REPORTS & PROFITS ====================

async function loadFinancialReport(period = 'today', customStart = '', customEnd = '') {
  currentReportPeriod = period;

  // Update active period buttons
  document.querySelectorAll('.rep-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target && event.target.classList.contains('rep-btn')) {
    event.target.classList.add('active');
  }

  let url = `/api/reports/financial?range=${period}`;
  if (period === 'custom' && customStart && customEnd) {
    url += `&startDate=${customStart}&endDate=${customEnd}`;
  }

  try {
    const res = await api(url);
    const sum = res.summary;

    document.getElementById('repTotalRevenue').textContent = `Rs. ${sum.totalSalesRevenue.toLocaleString()}`;
    document.getElementById('repCostGoods').textContent = `Rs. ${sum.costOfGoodsSold.toLocaleString()}`;
    document.getElementById('repGrossProfit').textContent = `Rs. ${sum.grossProfit.toLocaleString()}`;
    document.getElementById('repNetProfit').textContent = `Rs. ${sum.netProfit.toLocaleString()}`;

    // Category breakdown
    renderCategoryBreakdown(res.categoryBreakdown, res.departments, res.summary);

    // Salesmen comparison
    renderSalesmenPerformance(res.salesmanPerformance);

    // Load Stock valuation in parallel
    loadInventoryValuation();

  } catch (err) {
    console.error('Error loading report:', err);
  }
}

function renderCategoryBreakdown(cats, deps, summary) {
  const container = document.getElementById('repCategoryBreakdownList');
  if (!container) return;
  container.innerHTML = '';

  const allEntries = [];

  // Pos categories
  for (const [k, v] of Object.entries(cats || {})) {
    let title = k;
    if (k === 'Accessories') title = 'Mobile Accessories';
    else if (k === 'Spare Parts') title = 'Spare Parts';
    else if (k === 'Sheets & Skins') title = 'Back Sheets & Skins';
    else if (k === 'Services') title = 'Media & Software Services';

    allEntries.push({
      title,
      sales: v.salesAmount,
      profit: v.profitAmount,
      units: `${v.quantity} pcs`
    });
  }

  // Add Repairing Department
  if (deps && deps.repairsProfit !== undefined) {
    allEntries.push({
      title: 'Mobile Hardware & Software Repairing',
      sales: (summary && summary.repairsRevenue !== undefined ? summary.repairsRevenue : (deps.repairsProfit || 0)),
      profit: deps.repairsProfit,
      units: 'Service Lab'
    });
  }

  // Add Easyload
  if (deps && deps.easyloadProfit !== undefined) {
    allEntries.push({
      title: 'Mobile Easyload (Commission & Profit)',
      sales: deps.easyloadProfit * 35, // turnover
      profit: deps.easyloadProfit,
      units: 'Telecom'
    });
  }

  // Add JazzCash / EasyPaisa
  if (deps && deps.moneyTransferProfit !== undefined) {
    allEntries.push({
      title: 'JazzCash & EasyPaisa Transfer (Fees & Profit)',
      sales: deps.moneyTransferProfit * 50,
      profit: deps.moneyTransferProfit,
      units: 'Financial Services'
    });
  }

  if (allEntries.length === 0) {
    container.innerHTML = '<p class="text-slate-400 py-4 text-center">No records found for this period</p>';
    return;
  }

  allEntries.forEach(item => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/60 transition';
    div.innerHTML = `
      <div>
        <h5 class="font-bold text-slate-800 text-xs">${item.title}</h5>
        <span class="text-[10px] text-slate-400">${item.units}</span>
      </div>
      <div class="text-right font-mono">
        <div class="font-bold text-emerald-700 text-xs">Profit: Rs. ${item.profit.toLocaleString()}</div>
        <div class="text-[10px] text-slate-500">Sales: Rs. ${item.sales.toLocaleString()}</div>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderSalesmenPerformance(salesmen) {
  const container = document.getElementById('repSalesmenPerformanceList');
  if (!container) return;
  container.innerHTML = '';

  const entries = Object.entries(salesmen || {});
  if (entries.length === 0) {
    container.innerHTML = '<p class="text-slate-400 py-4 text-center">No salesman sales recorded</p>';
    return;
  }

  entries.forEach(([name, data]) => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100/60 transition';
    div.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
          ${name.charAt(0)}
        </div>
        <div>
          <h5 class="font-bold text-slate-800 text-xs">${name}</h5>
          <span class="text-[10px] text-slate-400">${data.salesCount} bills generated</span>
        </div>
      </div>
      <div class="font-mono font-bold text-slate-900 text-xs">
        Rs. ${data.totalAmount.toLocaleString()}
      </div>
    `;
    container.appendChild(div);
  });
}

// Custom Date Filter Prompt
function openCustomReportModal() {
  const start = prompt('Enter start date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
  if (!start) return;
  const end = prompt('Enter end date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
  if (!end) return;

  loadFinancialReport('custom', start, end);
}

// ==================== INVENTORY VALUATION ====================

async function loadInventoryValuation() {
  try {
    const res = await api('/api/reports/inventory-valuation');
    document.getElementById('invTotalUnits').textContent = `${res.totalStockUnits.toLocaleString()} pcs`;
    document.getElementById('invTotalCost').textContent = `Rs. ${res.totalCostValuation.toLocaleString()}`;
    document.getElementById('invTotalRetail').textContent = `Rs. ${res.totalRetailValuation.toLocaleString()}`;
    document.getElementById('invPotentialProfit').textContent = `Rs. ${res.potentialGrossProfit.toLocaleString()}`;
  } catch (e) {}
}

// ==================== SHOP EXPENSES (ROZNAMCHA) ====================

async function loadExpensesView() {
  const tableBody = document.getElementById('expensesTableBody');
  const totalBadge = document.getElementById('expensesTotalBadge');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Loading expenses...</td></tr>';

  try {
    const res = await api('/api/expenses');
    tableBody.innerHTML = '';

    const canDeleteExp = state.user?.role === 'admin' || hasPerm('expensesKhata.editDelete');
    const canAddExp = state.user?.role === 'admin' || hasPerm('expensesKhata.add');

    const formExp = document.getElementById('formAddExpense');
    if (formExp) {
      formExp.querySelectorAll('input, select, textarea, button').forEach(el => {
        el.disabled = !canAddExp;
      });
    }

    const total = res.expenses.reduce((sum, e) => sum + e.amount, 0);
    totalBadge.textContent = `Total Expenses: Rs. ${total.toLocaleString()}`;

    if (res.expenses.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">No expenses recorded</td></tr>';
      return;
    }

    res.expenses.forEach(exp => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="p-3 font-semibold text-slate-800">${exp.title}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">${exp.category}</span></td>
        <td class="p-3 font-bold text-rose-600 font-mono">Rs. ${exp.amount.toLocaleString()}</td>
        <td class="p-3 text-slate-500">${exp.paidBy}</td>
        <td class="p-3 text-slate-400 font-mono text-[11px]">${exp.date}</td>
        <td class="p-3 text-center">
          ${canDeleteExp ? `
            <button onclick="deleteExpenseConfirm('${exp.id}')" title="Delete Expense" class="text-slate-400 hover:text-rose-600 p-1">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          ` : '<span class="text-slate-300 text-xs">-</span>'}
        </td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Error: ${err.message}</td></tr>`;
  }
}

async function submitAddExpense(e) {
  e.preventDefault();
  if (state.user?.role !== 'admin' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to add expenses.', 'error');
    return;
  }
  const title = document.getElementById('expTitle').value;
  const category = document.getElementById('expCategory').value;
  const amount = document.getElementById('expAmount').value;
  const notes = document.getElementById('expNotes').value;

  try {
    const res = await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ title, category, amount, notes })
    });

    showToast(res.message, 'success');
    document.getElementById('expTitle').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expNotes').value = '';

    loadExpensesView();
    loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteExpenseConfirm(expId) {
  if (!confirm('Are you sure you want to delete this expense? The amount will be returned to Cash in Hand.')) return;

  try {
    const res = await api(`/api/expenses/${expId}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    loadExpensesView();
    loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== KHATA (CUSTOMER CREDIT) ====================
// Khata logic is fully handled by dedicated module: public/js/khata.js

// ==================== USERS & SALES STAFF (ADMIN ONLY) ====================

let usersListCache = [];

async function loadUsersList() {
  const grid = document.getElementById('usersGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';

  try {
    const res = await api('/api/users');
    usersListCache = res.users || [];
    grid.innerHTML = '';

    if (usersListCache.length === 0) {
      grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400">No staff or user accounts found.</div>';
      return;
    }

    usersListCache.forEach(u => {
      const isPrimaryAdmin = u.username.toLowerCase() === 'admin';
      const isSelf = state.user && state.user.id === u.id;
      const isAdminRole = u.role === 'admin';
      const isActive = u.active !== false;

      const card = document.createElement('div');
      card.className = `bg-white rounded-xl border ${isActive ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'} shadow-sm p-4 space-y-3 hover:border-slate-300 transition-all`;
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-full ${isAdminRole ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800'} flex items-center justify-center font-bold text-sm">
              <i class="fa-solid ${isAdminRole ? 'fa-user-shield' : 'fa-user'}"></i>
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-bold text-sm text-slate-900">${u.fullName}</h4>
                ${!isActive ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">Inactive</span>' : ''}
              </div>
              <span class="text-xs text-slate-400 font-mono">@${u.username}</span>
            </div>
          </div>
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isAdminRole ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-teal-50 text-teal-800 border border-teal-200'}">
            ${isAdminRole ? 'Admin' : 'Sales Staff'}
          </span>
        </div>

        <div class="space-y-1.5 text-xs text-slate-600">
          <div class="flex justify-between">
            <span class="text-slate-400">PIN Code:</span>
            <span class="font-mono font-bold text-slate-800">${u.pin || '1234'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Mobile Phone:</span>
            <span class="font-mono text-slate-800">${u.phone || '-'}</span>
          </div>
          <div>
            <span class="text-slate-400 block mb-1">Assigned Permissions:</span>
            ${isAdminRole ? `
              <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                <i class="fa-solid fa-lock-open text-emerald-600"></i> Full System Access (Admin)
              </span>
            ` : `
              <div class="flex flex-wrap gap-1">
                ${u.permissions?.pos?.create !== false ? '<span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold border border-emerald-200">POS Sale</span>' : '<span class="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] line-through">POS</span>'}
                ${u.permissions?.pos?.discount ? '<span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold border border-emerald-200">Discount</span>' : ''}
                ${u.permissions?.pos?.editDelete ? '<span class="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-200">Edit/Del Inv</span>' : ''}
                ${u.permissions?.inventory?.view !== false ? '<span class="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-200">Stock View</span>' : '<span class="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] line-through">Stock</span>'}
                ${u.permissions?.inventory?.manage ? '<span class="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold border border-blue-200">Stock Manage</span>' : ''}
                ${u.permissions?.inventory?.delete ? '<span class="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-200">Stock Del</span>' : ''}
                ${u.permissions?.repairs?.add !== false ? '<span class="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-200">Repairs Add</span>' : ''}
                ${u.permissions?.repairs?.updateStatus !== false ? '<span class="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-200">Repairs Status</span>' : ''}
                ${u.permissions?.repairs?.delete ? '<span class="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-200">Repairs Del</span>' : ''}
                ${u.permissions?.banking?.entry !== false ? '<span class="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold border border-purple-200">Banking Entry</span>' : ''}
                ${u.permissions?.banking?.balances ? '<span class="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[9px] font-bold border border-purple-200">Balances View</span>' : ''}
                ${u.permissions?.reports?.view ? '<span class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold border border-emerald-200">Reports Allowed</span>' : '<span class="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px]">Reports Blocked</span>'}
                ${u.permissions?.expensesKhata?.add !== false ? '<span class="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-bold border border-teal-200">Khata/Exp Add</span>' : ''}
                ${u.permissions?.expensesKhata?.editDelete ? '<span class="px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded text-[9px] font-bold border border-rose-200">Khata Edit/Del</span>' : ''}
                ${u.permissions?.expensesKhata?.viewKhata !== false ? '<span class="px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-bold border border-teal-200">Full Khata View</span>' : ''}
              </div>
            `}
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          ${isPrimaryAdmin ? `
            <span class="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <i class="fa-solid fa-shield-halved text-emerald-600"></i> Primary Root Admin
            </span>
            <div class="flex items-center gap-1.5">
              <button onclick="openEditStaffUserModal('${u.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs" title="Edit Admin Details">
                <i class="fa-solid fa-user-pen text-blue-600 text-[10px]"></i> Edit
              </button>
              <button onclick="promptResetSalesmanPin('${u.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors" title="Change Password / PIN">
                <i class="fa-solid fa-key text-[10px]"></i> PIN / Pass
              </button>
            </div>
          ` : `
            <div>
              ${isSelf ? `
                <span class="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <i class="fa-solid fa-circle-check"></i> Current Account
                </span>
              ` : `
                <span class="text-[11px] text-slate-400">
                  ${isAdminRole ? 'Administrator' : 'Sale Staff'}
                </span>
              `}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="openEditStaffUserModal('${u.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs" title="Edit Staff / User Profile">
                <i class="fa-solid fa-user-pen text-blue-600 text-[10px]"></i> Edit
              </button>
              <button onclick="promptResetSalesmanPin('${u.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors" title="Quick Reset PIN">
                <i class="fa-solid fa-key text-[10px]"></i> PIN
              </button>
              ${!isSelf ? `
                <button onclick="deleteStaffUserConfirm('${u.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 hover:border-rose-300 rounded text-xs font-semibold flex items-center gap-1 transition-colors" title="Delete Account">
                  <i class="fa-solid fa-trash-can text-[10px]"></i>
                </button>
              ` : ''}
            </div>
          `}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full text-center text-rose-500 py-8 text-xs">Error: ${err.message}</div>`;
  }
}

async function deleteStaffUserConfirm(userId) {
  const user = usersListCache.find(u => u.id === userId);
  const targetName = user ? user.fullName : 'this account';
  const roleName = user && user.role === 'admin' ? 'administrator' : 'sales staff';

  if (!confirm(`Are you sure you want to delete ${roleName} "${targetName}"?\n\nThis account will be permanently removed and will no longer have access to log in.`)) {
    return;
  }

  try {
    const res = await api(`/api/users/${userId}`, { method: 'DELETE' });
    showToast(res.message || 'Account deleted successfully', 'success');
    loadUsersList();
    if (typeof loadSalesmenDropdown === 'function') {
      loadSalesmenDropdown();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Alias for convenience
window.deleteStaffUserConfirm = deleteStaffUserConfirm;
window.deleteUserConfirm = deleteStaffUserConfirm;

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

function setUserModalRole(role) {
  const roleInput = document.getElementById('salesmanRole');
  const btnAdmin = document.getElementById('roleBtnAdmin');
  const btnSales = document.getElementById('roleBtnSalesman');
  const badge = document.getElementById('userRoleBadgeInfo');
  const title = document.getElementById('modalAddUserTitle');
  const icon = document.getElementById('modalAddUserIcon');
  const btnSubmit = document.getElementById('btnSubmitAddUser');
  const lblPassword = document.getElementById('lblUserPassword');
  const isEditing = Boolean(document.getElementById('salesmanEditId')?.value);

  const secPerms = document.getElementById('secStaffPermissions');

  if (roleInput) roleInput.value = role;

  if (role === 'admin') {
    if (btnAdmin) btnAdmin.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-sm';
    if (btnSales) btnSales.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900';
    if (badge) {
      badge.className = 'p-2.5 rounded-lg border text-[11px] flex items-center gap-2 bg-emerald-50 border-emerald-200 text-emerald-800';
      badge.innerHTML = '<i class="fa-solid fa-shield-halved text-emerald-600 text-base"></i><div><span class="font-bold block">Administrator Privileges</span><span class="text-slate-500">Full access to Reports, Expenses, Cash Drawer, Inventory Costs & Settings.</span></div>';
    }
    if (secPerms) secPerms.classList.add('hidden');
    if (!isEditing && title) title.textContent = 'Add New Administrator / Manager';
    if (!isEditing && icon) icon.className = 'fa-solid fa-user-shield text-emerald-600';
    if (!isEditing && btnSubmit) {
      btnSubmit.className = 'px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow transition';
      btnSubmit.textContent = 'Save Administrator Account';
    }
    if (lblPassword) lblPassword.textContent = isEditing ? 'New Password (Optional)' : 'Login Password *';
  } else {
    if (btnSales) btnSales.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 bg-teal-600 text-white shadow-sm';
    if (btnAdmin) btnAdmin.className = 'flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900';
    if (badge) {
      badge.className = 'p-2.5 rounded-lg border text-[11px] flex items-center gap-2 bg-teal-50 border-teal-200 text-teal-800';
      badge.innerHTML = '<i class="fa-solid fa-cash-register text-teal-600 text-base"></i><div><span class="font-bold block">Staff Role</span><span class="text-slate-500">Configure specific granular permissions below for POS, Inventory, Repairs, Banking, Reports, and Khata.</span></div>';
    }
    if (secPerms) secPerms.classList.remove('hidden');
    if (!isEditing && title) title.textContent = 'Add New Sales Staff / Counter User';
    if (!isEditing && icon) icon.className = 'fa-solid fa-users text-teal-600';
    if (!isEditing && btnSubmit) {
      btnSubmit.className = 'px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow transition';
      btnSubmit.textContent = 'Save Staff Account';
    }
    if (lblPassword) lblPassword.textContent = isEditing ? 'New Password (Optional)' : 'Login Password (Optional, PIN can be used)';
  }
}
window.setUserModalRole = setUserModalRole;

// Quick RBAC Permission Presets
function applyPermissionsPreset(preset) {
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(val);
  };

  if (preset === 'counter') {
    setChk('perm_pos_create', true);
    setChk('perm_pos_discount', true);
    setChk('perm_pos_editDelete', false);
    setChk('perm_inventory_view', true);
    setChk('perm_inventory_manage', false);
    setChk('perm_inventory_delete', false);
    setChk('perm_repairs_add', true);
    setChk('perm_repairs_updateStatus', true);
    setChk('perm_repairs_delete', false);
    setChk('perm_banking_entry', true);
    setChk('perm_banking_balances', false);
    setChk('perm_reports_view', false);
    setChk('perm_expensesKhata_add', true);
    setChk('perm_expensesKhata_editDelete', false);
    setChk('perm_expensesKhata_viewKhata', true);
  } else if (preset === 'technician') {
    setChk('perm_pos_create', true);
    setChk('perm_pos_discount', false);
    setChk('perm_pos_editDelete', false);
    setChk('perm_inventory_view', true);
    setChk('perm_inventory_manage', false);
    setChk('perm_inventory_delete', false);
    setChk('perm_repairs_add', true);
    setChk('perm_repairs_updateStatus', true);
    setChk('perm_repairs_delete', true);
    setChk('perm_banking_entry', false);
    setChk('perm_banking_balances', false);
    setChk('perm_reports_view', false);
    setChk('perm_expensesKhata_add', false);
    setChk('perm_expensesKhata_editDelete', false);
    setChk('perm_expensesKhata_viewKhata', false);
  } else if (preset === 'all') {
    setChk('perm_pos_create', true);
    setChk('perm_pos_discount', true);
    setChk('perm_pos_editDelete', true);
    setChk('perm_inventory_view', true);
    setChk('perm_inventory_manage', true);
    setChk('perm_inventory_delete', true);
    setChk('perm_repairs_add', true);
    setChk('perm_repairs_updateStatus', true);
    setChk('perm_repairs_delete', true);
    setChk('perm_banking_entry', true);
    setChk('perm_banking_balances', true);
    setChk('perm_reports_view', true);
    setChk('perm_expensesKhata_add', true);
    setChk('perm_expensesKhata_editDelete', true);
    setChk('perm_expensesKhata_viewKhata', true);
  } else if (preset === 'none') {
    setChk('perm_pos_create', false);
    setChk('perm_pos_discount', false);
    setChk('perm_pos_editDelete', false);
    setChk('perm_inventory_view', false);
    setChk('perm_inventory_manage', false);
    setChk('perm_inventory_delete', false);
    setChk('perm_repairs_add', false);
    setChk('perm_repairs_updateStatus', false);
    setChk('perm_repairs_delete', false);
    setChk('perm_banking_entry', false);
    setChk('perm_banking_balances', false);
    setChk('perm_reports_view', false);
    setChk('perm_expensesKhata_add', false);
    setChk('perm_expensesKhata_editDelete', false);
    setChk('perm_expensesKhata_viewKhata', false);
  }
}
window.applyPermissionsPreset = applyPermissionsPreset;

function resetUserModalCommon() {
  const editIdInp = document.getElementById('salesmanEditId');
  const userInput = document.getElementById('salesmanUser');
  const passNote = document.getElementById('noteUserPassword');
  const userNote = document.getElementById('noteSalesmanUser');
  const activeDiv = document.getElementById('divUserActiveToggle');
  const roleBtnAdmin = document.getElementById('roleBtnAdmin');
  const roleBtnSalesman = document.getElementById('roleBtnSalesman');

  if (editIdInp) editIdInp.value = '';
  if (userInput) {
    userInput.readOnly = false;
    userInput.title = '';
  }
  if (passNote) passNote.classList.add('hidden');
  if (userNote) userNote.classList.add('hidden');
  if (activeDiv) activeDiv.classList.add('hidden');
  if (roleBtnAdmin) roleBtnAdmin.classList.remove('opacity-40', 'pointer-events-none');
  if (roleBtnSalesman) roleBtnSalesman.classList.remove('opacity-40', 'pointer-events-none');
}

function openAddAdminModal() {
  resetUserModalCommon();
  document.getElementById('salesmanFullName').value = '';
  document.getElementById('salesmanUser').value = '';
  if (document.getElementById('salesmanPassword')) {
    document.getElementById('salesmanPassword').value = '';
    document.getElementById('salesmanPassword').placeholder = 'Enter password (e.g. dewan123)';
  }
  document.getElementById('salesmanPinCode').value = '7860';
  document.getElementById('salesmanPhoneNum').value = '';
  document.getElementById('salesmanFullName').placeholder = 'e.g. Dewan Rashid (Manager)';
  document.getElementById('salesmanUser').placeholder = 'rashid_admin';

  setUserModalRole('admin');
  openModal('modalAddSalesman');
}
window.openAddAdminModal = openAddAdminModal;

function openAddSalesmanModal() {
  resetUserModalCommon();
  document.getElementById('salesmanFullName').value = '';
  document.getElementById('salesmanUser').value = '';
  if (document.getElementById('salesmanPassword')) {
    document.getElementById('salesmanPassword').value = '';
    document.getElementById('salesmanPassword').placeholder = 'Enter password (e.g. 1234)';
  }
  document.getElementById('salesmanPinCode').value = '1234';
  document.getElementById('salesmanPhoneNum').value = '';
  document.getElementById('salesmanFullName').placeholder = 'e.g. Asad Ali (Counter 2)';
  document.getElementById('salesmanUser').placeholder = 'asad';

  setUserModalRole('salesman');
  applyPermissionsPreset('counter');
  openModal('modalAddSalesman');
}
window.openAddSalesmanModal = openAddSalesmanModal;

// Edit Existing Staff / User Profile
function openEditStaffUserModal(userId) {
  const user = usersListCache.find(u => u.id === userId);
  if (!user) {
    showToast('User account not found', 'error');
    return;
  }

  const isPrimaryAdmin = user.username && user.username.toLowerCase() === 'admin';

  // 1. Set edit ID
  const editIdInp = document.getElementById('salesmanEditId');
  if (editIdInp) editIdInp.value = user.id;

  // 2. Title and Icon
  const title = document.getElementById('modalAddUserTitle');
  const icon = document.getElementById('modalAddUserIcon');
  if (title) title.textContent = `Edit Account: "${user.fullName}"`;
  if (icon) icon.className = 'fa-solid fa-user-pen text-blue-600';

  // 3. Inputs prefill
  const nameInput = document.getElementById('salesmanFullName');
  const userInput = document.getElementById('salesmanUser');
  const passInput = document.getElementById('salesmanPassword');
  const passNote = document.getElementById('noteUserPassword');
  const userNote = document.getElementById('noteSalesmanUser');
  const pinInput = document.getElementById('salesmanPinCode');
  const phoneInput = document.getElementById('salesmanPhoneNum');
  const activeDiv = document.getElementById('divUserActiveToggle');
  const activeChk = document.getElementById('salesmanActiveStatus');
  const btnSubmit = document.getElementById('btnSubmitAddUser');
  const roleBtnAdmin = document.getElementById('roleBtnAdmin');
  const roleBtnSalesman = document.getElementById('roleBtnSalesman');

  if (nameInput) nameInput.value = user.fullName || '';
  if (userInput) {
    userInput.value = user.username || '';
    userInput.readOnly = isPrimaryAdmin;
    userInput.title = isPrimaryAdmin ? 'Primary root username cannot be renamed' : '';
  }
  if (userNote) {
    userNote.classList.toggle('hidden', !isPrimaryAdmin);
  }

  if (passInput) {
    passInput.value = '';
    passInput.placeholder = 'Leave blank to keep current password';
  }
  if (passNote) passNote.classList.remove('hidden');

  if (pinInput) pinInput.value = user.pin || (user.role === 'admin' ? '7860' : '1234');
  if (phoneInput) phoneInput.value = user.phone || '';

  // 4. Set role tabs
  setUserModalRole(user.role || 'salesman');

  // Populate Permissions Checkboxes
  const p = user.permissions || {};
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(val);
  };

  setChk('perm_pos_create', p.pos?.create !== false);
  setChk('perm_pos_discount', p.pos?.discount !== false && Boolean(p.pos?.discount));
  setChk('perm_pos_editDelete', Boolean(p.pos?.editDelete));
  setChk('perm_inventory_view', p.inventory?.view !== false);
  setChk('perm_inventory_manage', Boolean(p.inventory?.manage));
  setChk('perm_inventory_delete', Boolean(p.inventory?.delete));
  setChk('perm_repairs_add', p.repairs?.add !== false);
  setChk('perm_repairs_updateStatus', p.repairs?.updateStatus !== false);
  setChk('perm_repairs_delete', Boolean(p.repairs?.delete));
  setChk('perm_banking_entry', p.banking?.entry !== false);
  setChk('perm_banking_balances', Boolean(p.banking?.balances));
  setChk('perm_reports_view', Boolean(p.reports?.view));
  setChk('perm_expensesKhata_add', p.expensesKhata?.add !== false);
  setChk('perm_expensesKhata_editDelete', Boolean(p.expensesKhata?.editDelete));
  setChk('perm_expensesKhata_viewKhata', p.expensesKhata?.viewKhata !== false);

  // If primary admin, prevent role switching and account deactivation
  if (isPrimaryAdmin) {
    if (roleBtnSalesman) roleBtnSalesman.classList.add('opacity-40', 'pointer-events-none');
    if (activeDiv) activeDiv.classList.add('hidden');
  } else {
    if (roleBtnSalesman) roleBtnSalesman.classList.remove('opacity-40', 'pointer-events-none');
    if (roleBtnAdmin) roleBtnAdmin.classList.remove('opacity-40', 'pointer-events-none');
    if (activeDiv) activeDiv.classList.remove('hidden');
    if (activeChk) activeChk.checked = user.active !== false;
  }

  // 5. Submit button in Edit Mode
  if (btnSubmit) {
    btnSubmit.className = 'px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow flex items-center gap-1.5 transition';
    btnSubmit.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Update Account</span>';
  }

  openModal('modalAddSalesman');
  if (nameInput) {
    nameInput.focus();
    nameInput.select();
  }
}
window.openEditStaffUserModal = openEditStaffUserModal;

async function submitAddSalesman(e) {
  e.preventDefault();
  const editId = document.getElementById('salesmanEditId')?.value;
  const fullName = document.getElementById('salesmanFullName').value.trim();
  const username = document.getElementById('salesmanUser').value.trim();
  const password = document.getElementById('salesmanPassword')?.value.trim() || '';
  const pin = document.getElementById('salesmanPinCode').value.trim();
  const phone = document.getElementById('salesmanPhoneNum').value.trim();
  const role = document.getElementById('salesmanRole')?.value || 'salesman';
  const active = document.getElementById('salesmanActiveStatus')?.checked !== false;

  if (!fullName || !username) {
    showToast('Please enter full name and username', 'error');
    return;
  }

  // Gather Granular RBAC Permissions
  const permissions = {
    pos: {
      create: document.getElementById('perm_pos_create')?.checked ?? true,
      discount: document.getElementById('perm_pos_discount')?.checked ?? false,
      editDelete: document.getElementById('perm_pos_editDelete')?.checked ?? false
    },
    inventory: {
      view: document.getElementById('perm_inventory_view')?.checked ?? true,
      manage: document.getElementById('perm_inventory_manage')?.checked ?? false,
      delete: document.getElementById('perm_inventory_delete')?.checked ?? false
    },
    repairs: {
      add: document.getElementById('perm_repairs_add')?.checked ?? true,
      updateStatus: document.getElementById('perm_repairs_updateStatus')?.checked ?? true,
      delete: document.getElementById('perm_repairs_delete')?.checked ?? false
    },
    banking: {
      entry: document.getElementById('perm_banking_entry')?.checked ?? true,
      balances: document.getElementById('perm_banking_balances')?.checked ?? false
    },
    reports: {
      view: document.getElementById('perm_reports_view')?.checked ?? false
    },
    expensesKhata: {
      add: document.getElementById('perm_expensesKhata_add')?.checked ?? true,
      editDelete: document.getElementById('perm_expensesKhata_editDelete')?.checked ?? false,
      viewKhata: document.getElementById('perm_expensesKhata_viewKhata')?.checked ?? true
    }
  };

  const isEditing = Boolean(editId);
  const btn = document.getElementById('btnSubmitAddUser');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEditing ? 'Updating...' : 'Saving...'}`;
  }

  try {
    let res;
    if (isEditing) {
      // UPDATE ACCOUNT via PUT
      const payload = { fullName, username, pin, phone, role, active, permissions };
      if (password) payload.password = password;

      res = await api(`/api/users/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      // If updating currently logged in user, refresh local state
      if (state.user && state.user.id === editId) {
        state.user.permissions = res.user.permissions;
        state.user.fullName = res.user.fullName;
        if (typeof applyRolePermissions === 'function') applyRolePermissions();
      }
    } else {
      // CREATE ACCOUNT via POST
      if (role === 'admin' && !password && !pin) {
        showToast('Please provide a password or PIN for the administrator', 'error');
        if (btn) btn.disabled = false;
        return;
      }
      res = await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, username, password, pin, phone, role, permissions })
      });
    }

    showToast(res.message, 'success');
    closeModal('modalAddSalesman');
    loadUsersList();
    if (typeof loadSalesmenDropdown === 'function') {
      loadSalesmenDropdown();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.submitAddSalesman = submitAddSalesman;

async function promptResetSalesmanPin(userId, optionalName) {
  const user = usersListCache.find(u => u.id === userId);
  const name = user ? user.fullName : (optionalName || 'Account');
  const isAdmin = user && user.role === 'admin';

  if (isAdmin) {
    const newPass = prompt(`Enter new Password for Administrator "${name}" (leave blank to keep unchanged):`);
    const newPin = prompt(`Enter new 4-digit PIN for Administrator "${name}":`, user ? user.pin : '7860');

    if (!newPass && !newPin) return;

    const payload = {};
    if (newPass && newPass.trim() !== '') payload.password = newPass.trim();
    if (newPin && newPin.trim() !== '') payload.pin = newPin.trim();

    try {
      const res = await api(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showToast(res.message, 'success');
      loadUsersList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  } else {
    const newPin = prompt(`Enter new 4-digit PIN for ${name}:`, user ? user.pin : '1234');
    if (!newPin) return;

    try {
      const res = await api(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ pin: newPin.trim() })
      });
      showToast(res.message, 'success');
      loadUsersList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}
window.promptResetSalesmanPin = promptResetSalesmanPin;

