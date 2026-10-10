// Dewan Mobile POS - Mobile Banking, Pakistani Banks, EasyPaisa & Easyload Module

let activeBankingService = 'JazzCash';
let loadedPakistaniBanks = [];
let cachedBankingTransactions = [];

function initBankingView() {
  const isAdmin = Boolean(window.state?.user && window.state.user.role === 'admin');
  if (isAdmin || (typeof hasPerm === 'function' && hasPerm('banking.balances'))) {
    loadBankingBalances();
  }
  loadPakistaniBanks();
  loadBankingTransactions();
}

// ==================== BALANCES ====================

async function loadBankingBalances() {
  const isAdmin = Boolean(window.state?.user && window.state.user.role === 'admin');
  if (!isAdmin && typeof hasPerm === 'function' && !hasPerm('banking.balances')) {
    return;
  }
  try {
    const res = await api('/api/banking/balances');
    const b = res.balances || {};

    const elCash = document.getElementById('balCashInHand');
    if (elCash) elCash.textContent = `Rs. ${(b.cashInHand || 0).toLocaleString()}`;

    const elBank = document.getElementById('balBankTill');
    if (elBank) elBank.textContent = `Rs. ${(b.bankTill || 0).toLocaleString()}`;

    const elJazz = document.getElementById('balJazzCashTill');
    if (elJazz) elJazz.textContent = `Rs. ${(b.jazzCashTill || 0).toLocaleString()}`;

    const elEp = document.getElementById('balEasyPaisaTill');
    if (elEp) elEp.textContent = `Rs. ${(b.easyPaisaTill || 0).toLocaleString()}`;

    const elJazzLoad = document.getElementById('balJazzLoad');
    if (elJazzLoad) elJazzLoad.textContent = `Rs. ${(b.jazzLoadSim || 0).toLocaleString()}`;

    const elZongLoad = document.getElementById('balZongLoad');
    if (elZongLoad) elZongLoad.textContent = `Rs. ${(b.zongLoadSim || 0).toLocaleString()}`;

    const elTelenorLoad = document.getElementById('balTelenorLoad');
    if (elTelenorLoad) elTelenorLoad.textContent = `Rs. ${(b.telenorLoadSim || 0).toLocaleString()}`;
  } catch (e) {
    console.error('Error loading banking balances:', e);
  }
}

// ==================== PAKISTANI BANKS DIRECTORY ====================

async function loadPakistaniBanks() {
  try {
    const res = await api('/api/banking/banks');
    loadedPakistaniBanks = res.banks || [];

    const badge = document.getElementById('bankingBankCountBadge');
    if (badge) badge.textContent = loadedPakistaniBanks.length;

    populateBankSelectDropdown();

    // If directory modal is currently visible, refresh its view
    const modalManage = document.getElementById('modalManageBanks');
    if (modalManage && !modalManage.classList.contains('hidden')) {
      renderBanksDirectoryList();
    }
  } catch (err) {
    console.error('Error loading Pakistani banks:', err);
  }
}

function populateBankSelectDropdown() {
  const select = document.getElementById('bankingBankSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `
    <option value="">-- Choose Pakistani Bank --</option>
    <option value="__add_new__" class="font-bold text-blue-700 bg-blue-50">+ Add Any Other Bank...</option>
  `;

  // Categorize banks
  const customBanks = loadedPakistaniBanks.filter(b => !b.isDefault);
  const islamicBanks = loadedPakistaniBanks.filter(b => b.isDefault && (b.type === 'Islamic Bank' || (b.name && b.name.includes('Islamic'))));
  const commercialBanks = loadedPakistaniBanks.filter(b => b.isDefault && (b.type === 'Commercial Bank' || b.type === 'Foreign / Commercial' || b.type === 'Public Bank' || b.type === 'Specialized Bank') && !islamicBanks.includes(b));
  const microfinanceAndWallets = loadedPakistaniBanks.filter(b => b.isDefault && (b.type === 'Microfinance Bank' || b.type === 'Digital Wallet / EMI' || b.type === 'Digital Instant Payment'));

  // 1. Custom Added Banks
  if (customBanks.length > 0) {
    const optGroupCustom = document.createElement('optgroup');
    optGroupCustom.label = '⭐ Custom Added Banks';
    customBanks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} ${b.code ? `(${b.code})` : ''}`;
      optGroupCustom.appendChild(opt);
    });
    select.appendChild(optGroupCustom);
  }

  // 2. Commercial Banks
  if (commercialBanks.length > 0) {
    const optGroupComm = document.createElement('optgroup');
    optGroupComm.label = '🏛️ Commercial Banks (Pakistan)';
    commercialBanks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} ${b.code ? `(${b.code})` : ''}`;
      optGroupComm.appendChild(opt);
    });
    select.appendChild(optGroupComm);
  }

  // 3. Islamic Banks
  if (islamicBanks.length > 0) {
    const optGroupIsl = document.createElement('optgroup');
    optGroupIsl.label = '🌙 Islamic Banks (Shariah Compliant)';
    islamicBanks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} ${b.code ? `(${b.code})` : ''}`;
      optGroupIsl.appendChild(opt);
    });
    select.appendChild(optGroupIsl);
  }

  // 4. Microfinance & Digital Wallets / Raast
  if (microfinanceAndWallets.length > 0) {
    const optGroupDigi = document.createElement('optgroup');
    optGroupDigi.label = '📱 Microfinance, Digital Wallets & Raast';
    microfinanceAndWallets.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} ${b.code ? `(${b.code})` : ''}`;
      optGroupDigi.appendChild(opt);
    });
    select.appendChild(optGroupDigi);
  }

  // Restore selection if valid
  if (currentVal && loadedPakistaniBanks.some(b => b.id === currentVal)) {
    select.value = currentVal;
  }
}

function onBankSelectionChange(val) {
  if (val === '__add_new__') {
    const select = document.getElementById('bankingBankSelect');
    if (select) select.value = '';
    openAddBankModal();
    return;
  }

  if (val) {
    const selectedBank = loadedPakistaniBanks.find(b => b.id === val);
    const accInput = document.getElementById('bankingAccountNo');
    const titleInput = document.getElementById('bankingAccountTitle');
    
    // If bank has a default receiving account and input is empty, offer it as hint
    if (selectedBank && selectedBank.defaultAccount && accInput && !accInput.value) {
      accInput.placeholder = `Shop default: ${selectedBank.defaultAccount}`;
    }
  }
}

// ==================== SERVICE SWITCHING ====================

function setBankingService(service) {
  activeBankingService = service;

  // Reset button styles
  document.querySelectorAll('.bank-srv-btn').forEach(b => {
    b.classList.remove('active', 'bg-red-600', 'bg-emerald-600', 'bg-blue-600', 'bg-amber-600', 'bg-purple-600', 'text-white');
    b.classList.add('bg-slate-100', 'text-slate-700');
  });

  const btnIdMap = {
    'JazzCash': 'srv-JazzCash',
    'EasyPaisa': 'srv-EasyPaisa',
    'Bank Transfer': 'srv-BankTransfer',
    'Easyload': 'srv-Easyload',
    'Bill': 'srv-Bill'
  };

  const activeBtn = document.getElementById(btnIdMap[service]);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-100', 'text-slate-700');
    activeBtn.classList.add('active');

    if (service === 'JazzCash') activeBtn.classList.add('bg-red-600', 'text-white');
    else if (service === 'EasyPaisa') activeBtn.classList.add('bg-emerald-600', 'text-white');
    else if (service === 'Bank Transfer') activeBtn.classList.add('bg-blue-600', 'text-white');
    else if (service === 'Easyload') activeBtn.classList.add('bg-amber-600', 'text-white');
    else if (service === 'Bill') activeBtn.classList.add('bg-purple-600', 'text-white');
  }

  const divBank = document.getElementById('divBankFields');
  const divTxType = document.getElementById('divTxType');
  const divNetwork = document.getElementById('divNetwork');
  const selType = document.getElementById('bankingType');

  if (service === 'Bank Transfer') {
    if (divBank) divBank.classList.remove('hidden');
    if (divNetwork) divNetwork.classList.add('hidden');
    if (divTxType) divTxType.classList.remove('hidden');

    if (selType) {
      selType.innerHTML = `
        <option value="CashIn">Cash In / Send Money (Shop Transfers to Customer Bank)</option>
        <option value="CashOut">Cash Out / Receive (Customer Transfers to Shop, Takes Cash)</option>
      `;
    }
  } else if (service === 'Easyload') {
    if (divBank) divBank.classList.add('hidden');
    if (divNetwork) divNetwork.classList.remove('hidden');
    if (divTxType) divTxType.classList.add('hidden');
  } else if (service === 'Bill') {
    if (divBank) divBank.classList.add('hidden');
    if (divNetwork) divNetwork.classList.add('hidden');
    if (divTxType) divTxType.classList.add('hidden');
  } else {
    // JazzCash or EasyPaisa
    if (divBank) divBank.classList.add('hidden');
    if (divNetwork) divNetwork.classList.add('hidden');
    if (divTxType) divTxType.classList.remove('hidden');

    if (selType) {
      selType.innerHTML = `
        <option value="CashIn">Cash In / Send Money (Customer Gives Cash)</option>
        <option value="CashOut">Cash Out / Receive Cash (Withdrawal)</option>
      `;
    }
  }
}

// ==================== ADD NEW BANK MODAL ====================

function openAddBankModal() {
  const form = document.getElementById('formAddBank');
  if (form) form.reset();
  const m = document.getElementById('modalAddBank');
  if (m) {
    m.classList.remove('hidden');
    setTimeout(() => {
      const input = document.getElementById('newBankName');
      if (input) input.focus();
    }, 100);
  }
}

function closeAddBankModal() {
  const m = document.getElementById('modalAddBank');
  if (m) m.classList.add('hidden');
}

async function submitAddNewBank(e) {
  e.preventDefault();
  const name = document.getElementById('newBankName').value.trim();
  const code = document.getElementById('newBankCode').value.trim();
  const type = document.getElementById('newBankType').value;
  const defaultAccount = document.getElementById('newBankDefaultAcc').value.trim();
  const defaultTitle = document.getElementById('newBankDefaultTitle').value.trim();

  if (!name) {
    showToast('Please enter a bank name', 'error');
    return;
  }

  try {
    const res = await api('/api/banking/banks', {
      method: 'POST',
      body: JSON.stringify({
        name,
        shortName: name,
        code,
        type,
        defaultAccount,
        defaultTitle
      })
    });

    showToast(res.message || 'Bank added successfully', 'success');
    closeAddBankModal();

    await loadPakistaniBanks();

    // Automatically switch to Bank Transfer and select this new bank
    if (activeBankingService !== 'Bank Transfer') {
      setBankingService('Bank Transfer');
    }
    const select = document.getElementById('bankingBankSelect');
    if (select && res.bank) {
      select.value = res.bank.id;
    }
  } catch (err) {
    showToast(err.message || 'Failed to add bank', 'error');
  }
}

// ==================== MANAGE BANKS DIRECTORY ====================

function openManageBanksModal() {
  const m = document.getElementById('modalManageBanks');
  if (m) {
    m.classList.remove('hidden');
    renderBanksDirectoryList();
  }
}

function closeManageBanksModal() {
  const m = document.getElementById('modalManageBanks');
  if (m) m.classList.add('hidden');
}

function renderBanksDirectoryList() {
  const container = document.getElementById('banksDirectoryList');
  if (!container) return;

  const search = (document.getElementById('searchBanksInput')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('filterBankCategory')?.value || 'All';

  let filtered = [...loadedPakistaniBanks];

  if (categoryFilter === 'Custom') {
    filtered = filtered.filter(b => !b.isDefault);
  } else if (categoryFilter !== 'All') {
    filtered = filtered.filter(b => b.type === categoryFilter);
  }

  if (search) {
    filtered = filtered.filter(b => 
      (b.name && b.name.toLowerCase().includes(search)) ||
      (b.code && b.code.toLowerCase().includes(search)) ||
      (b.type && b.type.toLowerCase().includes(search))
    );
  }

  const summary = document.getElementById('banksDirectorySummary');
  if (summary) {
    const customCount = loadedPakistaniBanks.filter(b => !b.isDefault).length;
    summary.textContent = `Showing ${filtered.length} of ${loadedPakistaniBanks.length} banks (${customCount} custom added)`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-400">
        <i class="fa-solid fa-building-columns text-3xl mb-2 text-slate-300"></i>
        <p class="font-medium text-xs">No banks match your search or filter</p>
        <button type="button" onclick="openAddBankModal()" class="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition">
          + Add New Bank Now
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(bank => {
    const item = document.createElement('div');
    item.className = 'p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5';

    let typeColor = 'bg-blue-100 text-blue-800';
    if (bank.type === 'Islamic Bank') typeColor = 'bg-emerald-100 text-emerald-800';
    else if (bank.type === 'Microfinance Bank') typeColor = 'bg-amber-100 text-amber-800';
    else if (bank.type === 'Digital Wallet / EMI' || bank.type === 'Digital Instant Payment') typeColor = 'bg-purple-100 text-purple-800';
    else if (!bank.isDefault) typeColor = 'bg-indigo-100 text-indigo-800 font-bold';

    item.innerHTML = `
      <div class="flex items-start gap-3 flex-1 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
          <i class="fa-solid fa-building-columns text-sm"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-slate-900 text-xs truncate">${bank.name}</span>
            ${bank.code ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">${bank.code}</span>` : ''}
            ${!bank.isDefault ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Custom Bank</span>` : ''}
          </div>
          <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
            <span class="px-1.5 py-0.2 rounded text-[10px] font-medium ${typeColor}">${bank.type || 'Commercial Bank'}</span>
            ${bank.defaultAccount ? `<span class="font-mono text-slate-600"><i class="fa-solid fa-credit-card mr-1 text-slate-400"></i>${bank.defaultAccount}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1.5 self-end sm:self-center shrink-0">
        <button type="button" onclick="selectBankForTransaction('${bank.id}')" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition flex items-center gap-1">
          <i class="fa-solid fa-arrow-right text-[10px]"></i> Use Bank
        </button>
        ${!bank.isDefault ? `
          <button type="button" onclick="deleteCustomBank('${bank.id}', '${encodeURIComponent(bank.name)}')" title="Delete Custom Bank" class="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs flex items-center justify-center transition border border-rose-200">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(item);
  });
}

function selectBankForTransaction(bankId) {
  closeManageBanksModal();
  setBankingService('Bank Transfer');
  const select = document.getElementById('bankingBankSelect');
  if (select) {
    select.value = bankId;
    onBankSelectionChange(bankId);
  }
  const accInput = document.getElementById('bankingAccountNo');
  if (accInput) accInput.focus();
}

async function deleteCustomBank(bankId, encodedName) {
  const bankName = decodeURIComponent(encodedName);
  if (!confirm(`Are you sure you want to remove the custom bank '${bankName}'?`)) {
    return;
  }

  try {
    const res = await api(`/api/banking/banks/${bankId}`, {
      method: 'DELETE'
    });
    showToast(res.message || 'Bank removed', 'success');
    await loadPakistaniBanks();
  } catch (err) {
    showToast(err.message || 'Failed to delete bank', 'error');
  }
}

// ==================== SUBMIT TRANSACTION ====================

async function submitBankingTransaction(e) {
  e.preventDefault();

  if (typeof hasPerm === 'function' && !hasPerm('banking.entry')) {
    showToast('Permission denied: You do not have permission to record banking transactions.', 'error');
    return;
  }

  const amount = document.getElementById('bankingAmount').value;
  const customerPhone = document.getElementById('bankingCustomerPhone').value;
  const customerName = document.getElementById('bankingCustomerName').value;
  const feeCharged = document.getElementById('bankingFee').value;
  const commissionEarned = document.getElementById('bankingComm').value;
  const notes = document.getElementById('bankingNotes').value;

  let type = 'CashIn';
  let bankId = '';
  let bankName = '';
  let accountNumber = '';
  let accountTitle = '';
  const network = document.getElementById('bankingNetwork').value;

  if (activeBankingService === 'Easyload') {
    type = 'Load';
  } else if (activeBankingService === 'Bill') {
    type = 'Bill';
  } else if (activeBankingService === 'Bank Transfer') {
    type = document.getElementById('bankingType').value;
    bankId = document.getElementById('bankingBankSelect').value;

    if (!bankId || bankId === '__add_new__') {
      showToast('Please select a Pakistani Bank from the list', 'error');
      document.getElementById('bankingBankSelect').focus();
      return;
    }

    const b = loadedPakistaniBanks.find(x => x.id === bankId);
    bankName = b ? b.name : 'Bank Transfer';
    accountNumber = document.getElementById('bankingAccountNo').value.trim();
    accountTitle = document.getElementById('bankingAccountTitle').value.trim();

    if (!accountNumber) {
      showToast('Please enter the customer Bank Account #, IBAN or Raast ID', 'error');
      document.getElementById('bankingAccountNo').focus();
      return;
    }
  } else {
    // JazzCash or EasyPaisa
    type = document.getElementById('bankingType').value;
  }

  const payload = {
    service: activeBankingService,
    type,
    network,
    bankId,
    bankName,
    accountNumber,
    accountTitle,
    customerPhone,
    customerName,
    amount,
    feeCharged,
    commissionEarned,
    notes
  };

  try {
    const btn = document.getElementById('btnSubmitBankingTx');
    if (btn) btn.disabled = true;

    const res = await api('/api/banking/transactions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showToast(res.message, 'success');

    // Reset inputs
    document.getElementById('bankingAmount').value = '';
    document.getElementById('bankingFee').value = '0';
    document.getElementById('bankingComm').value = '0';
    document.getElementById('bankingNotes').value = '';
    const accField = document.getElementById('bankingAccountNo');
    if (accField) accField.value = '';
    const titleField = document.getElementById('bankingAccountTitle');
    if (titleField) titleField.value = '';

    loadBankingBalances();
    loadBankingTransactions();
    if (typeof loadDashboardData === 'function') loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    const btn = document.getElementById('btnSubmitBankingTx');
    if (btn) btn.disabled = false;
  }
}

// ==================== TRANSACTION HISTORY ====================

async function loadBankingTransactions() {
  const tableBody = document.getElementById('bankingTxTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Loading transactions...</td></tr>';

  try {
    const res = await api('/api/banking/transactions');
    cachedBankingTransactions = res.transactions || [];
    filterBankingTransactions();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-500">Error: ${err.message}</td></tr>`;
  }
}

function filterBankingTransactions() {
  const filterSelect = document.getElementById('bankingHistoryFilter');
  const serviceFilter = filterSelect ? filterSelect.value : 'All';

  let list = [...cachedBankingTransactions];
  if (serviceFilter !== 'All') {
    list = list.filter(t => t.service === serviceFilter);
  }

  const badge = document.getElementById('bankingTxCountBadge');
  if (badge) badge.textContent = list.length;

  renderBankingTransactions(list);
}

function renderBankingTransactions(list) {
  const tableBody = document.getElementById('bankingTxTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (!list || list.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">No transactions found</td></tr>';
    return;
  }

  const isAdmin = state.user && state.user.role === 'admin';

  list.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    let srvBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Other</span>';
    if (t.service === 'JazzCash') {
      srvBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">JazzCash</span>';
    } else if (t.service === 'EasyPaisa') {
      srvBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">EasyPaisa</span>';
    } else if (t.service === 'Bank Transfer') {
      const bName = t.bankName || 'Bank Transfer';
      srvBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1 w-max"><i class="fa-solid fa-building-columns text-[10px]"></i> ${bName}</span>`;
    } else if (t.service === 'Easyload') {
      srvBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">${t.network || ''} Load</span>`;
    } else if (t.service === 'Bill') {
      srvBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Bill Payment</span>';
    }

    let typeLabel = t.type;
    if (t.type === 'CashIn') typeLabel = t.service === 'Bank Transfer' ? 'Send / Deposit' : 'Cash In (Send)';
    else if (t.type === 'CashOut') typeLabel = t.service === 'Bank Transfer' ? 'Receive / Withdraw' : 'Cash Out (Receive)';
    else if (t.type === 'Load') typeLabel = 'Mobile Load';
    else if (t.type === 'Bill') typeLabel = 'Bill Payment';

    let customerCellHtml = '';
    if (t.service === 'Bank Transfer') {
      customerCellHtml = `
        <div class="font-semibold text-slate-800 font-mono text-[11px]">${t.accountNumber || t.customerPhone || '-'}</div>
        <div class="text-[10px] text-slate-500">
          ${t.accountTitle ? `<span class="font-medium text-blue-900">${t.accountTitle}</span>` : ''}
          ${t.customerPhone ? `<span class="text-slate-400 ml-1">(${t.customerPhone})</span>` : ''}
        </div>
      `;
    } else {
      customerCellHtml = `
        <div class="font-semibold text-slate-800 font-mono">${t.customerPhone || '-'}</div>
        ${t.customerName ? `<span class="text-[10px] text-slate-400 block">${t.customerName}</span>` : ''}
      `;
    }

    tr.innerHTML = `
      <td class="p-3">
        ${srvBadge}
        <span class="text-[10px] text-slate-400 block mt-0.5">${typeLabel}</span>
      </td>
      <td class="p-3">
        ${customerCellHtml}
      </td>
      <td class="p-3 font-bold text-slate-900 font-mono">Rs. ${(t.amount || 0).toLocaleString()}</td>
      ${isAdmin ? `
        <td class="p-3 font-bold text-emerald-700 font-mono admin-only">
          Rs. ${(t.netProfit || 0).toLocaleString()}
        </td>
      ` : ''}
      <td class="p-3 text-slate-500">${t.salesmanName || '-'}</td>
      <td class="p-3 text-slate-400 font-mono text-[11px]">${t.date || ''}</td>
    `;

    tableBody.appendChild(tr);
  });
}

// ==================== ADJUST BALANCES (ADMIN ONLY) ====================

async function openAdjustBalancesModal() {
  try {
    const res = await api('/api/banking/balances');
    const b = res.balances || {};

    document.getElementById('adjCashInHand').value = b.cashInHand || 0;
    document.getElementById('adjBankTill').value = b.bankTill || 0;
    document.getElementById('adjJazzCashTill').value = b.jazzCashTill || 0;
    document.getElementById('adjEasyPaisaTill').value = b.easyPaisaTill || 0;
    document.getElementById('adjJazzLoad').value = b.jazzLoadSim || 0;
    document.getElementById('adjZongLoad').value = b.zongLoadSim || 0;
    document.getElementById('adjTelenorLoad').value = b.telenorLoadSim || 0;

    const m = document.getElementById('modalAdjustBalances');
    if (m) m.classList.remove('hidden');
  } catch (err) {
    showToast(err.message || 'Failed to fetch balances', 'error');
  }
}

function closeAdjustBalancesModal() {
  const m = document.getElementById('modalAdjustBalances');
  if (m) m.classList.add('hidden');
}

async function submitAdjustBalances(e) {
  e.preventDefault();
  const payload = {
    cashInHand: Number(document.getElementById('adjCashInHand').value),
    bankTill: Number(document.getElementById('adjBankTill').value),
    jazzCashTill: Number(document.getElementById('adjJazzCashTill').value),
    easyPaisaTill: Number(document.getElementById('adjEasyPaisaTill').value),
    jazzLoadSim: Number(document.getElementById('adjJazzLoad').value),
    zongLoadSim: Number(document.getElementById('adjZongLoad').value),
    telenorLoadSim: Number(document.getElementById('adjTelenorLoad').value)
  };

  try {
    const res = await api('/api/banking/balances', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    showToast(res.message || 'Balances updated successfully', 'success');
    closeAdjustBalancesModal();
    loadBankingBalances();
  } catch (err) {
    showToast(err.message || 'Failed to update balances', 'error');
  }
}
