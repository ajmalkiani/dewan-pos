// Dewan Mobile POS - Customer Credit Khata (Udhaar) Module
// Covers: Items Sold, Total Amount, Amount Received, Amount Due, Pending Payment, 
// Payment History, Customer Balance, Credit Sale, Sales Statement, Due Items

let currentKhataList = [];
let currentKhataSummary = null;
let currentKhataFilter = 'all'; // 'all', 'pending', 'cleared'
let selectedKhataCustomer = null;
let creditSaleItems = [];

// ==================== KHATA LIST & DASHBOARD ====================

async function loadKhataList() {
  const grid = document.getElementById('khataCardsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="col-span-full py-16 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-600"></i><p class="text-xs font-semibold mt-2">Loading Credit Khata accounts...</p></div>';

  try {
    const res = await api('/api/khata');
    currentKhataList = res.khata || [];
    currentKhataSummary = res.summary || {};

    updateKhataSummaryMetrics();
    renderKhataCards();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full py-10 text-center text-rose-500 text-xs font-semibold">Error loading Khata: ${err.message}</div>`;
  }
}
window.loadKhataList = loadKhataList;

function updateKhataSummaryMetrics() {
  const sum = currentKhataSummary || {};
  const totCust = document.getElementById('kpiKhataTotalCustomers');
  const totBal = document.getElementById('kpiKhataCustomerBalance');
  const totSales = document.getElementById('kpiKhataTotalAmount');
  const totRec = document.getElementById('kpiKhataAmountReceived');
  const totPending = document.getElementById('kpiKhataPendingPayment');
  const totDueItems = document.getElementById('kpiKhataDueItems');

  if (totCust) totCust.textContent = (sum.totalCustomers || currentKhataList.length).toLocaleString();
  if (totBal) totBal.textContent = `Rs. ${(sum.totalCustomerBalance || 0).toLocaleString()}`;
  if (totSales) totSales.textContent = `Rs. ${(sum.totalAmount || 0).toLocaleString()}`;
  if (totRec) totRec.textContent = `Rs. ${(sum.totalAmountReceived || 0).toLocaleString()}`;
  if (totPending) totPending.textContent = `Rs. ${(sum.totalPendingPayment || 0).toLocaleString()}`;
  if (totDueItems) totDueItems.textContent = `${(sum.totalDueItemsCount || 0).toLocaleString()} Items`;
}

function setKhataFilter(filterType, btnElem) {
  currentKhataFilter = filterType;
  document.querySelectorAll('.khata-filter-btn').forEach(b => {
    b.classList.remove('bg-emerald-700', 'text-white', 'shadow');
    b.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
  });
  if (btnElem) {
    btnElem.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
    btnElem.classList.add('bg-emerald-700', 'text-white', 'shadow');
  }
  renderKhataCards();
}
window.setKhataFilter = setKhataFilter;

function renderKhataCards() {
  const grid = document.getElementById('khataCardsGrid');
  if (!grid) return;

  const search = (document.getElementById('khataSearchInput')?.value || '').toLowerCase().trim();

  let filtered = currentKhataList.filter(k => {
    // Search match
    const nameMatch = (k.customerName || '').toLowerCase().includes(search);
    const phoneMatch = (k.phone || '').toLowerCase().includes(search);
    const itemMatch = (k.itemsSold || []).some(it => (it.name || '').toLowerCase().includes(search));
    const invMatch = (k.creditSales || []).some(s => (s.invoiceNo || '').toLowerCase().includes(search));
    const matchesSearch = !search || nameMatch || phoneMatch || itemMatch || invMatch;

    if (!matchesSearch) return false;

    // Filter type match
    if (currentKhataFilter === 'pending') return k.customerBalance > 0;
    if (currentKhataFilter === 'cleared') return k.customerBalance <= 0;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-2xl">
          <i class="fa-solid fa-book-open"></i>
        </div>
        <h4 class="font-bold text-slate-700 text-sm">No Khata accounts found</h4>
        <p class="text-xs text-slate-400 mt-1">Try adjusting your search terms or create a new credit sale</p>
      </div>
    `;
    return;
  }

  const isAdmin = Boolean(window.state?.user && window.state.user.role === 'admin');
  const canAddKhata = isAdmin || (typeof hasPerm === 'function' && hasPerm('expensesKhata.add'));
  const canEditDeleteKhata = isAdmin || (typeof hasPerm === 'function' && hasPerm('expensesKhata.editDelete'));
  grid.innerHTML = '';

  filtered.forEach(k => {
    const hasBalance = k.customerBalance > 0;
    const dueItemsCount = k.dueItems ? k.dueItems.length : 0;

    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3 relative overflow-hidden';

    // Status strip on left
    const stripColor = hasBalance ? 'bg-rose-500' : 'bg-emerald-500';

    // Items preview list
    const itemsPreview = (k.itemsSold || []).slice(0, 3).map(it => {
      return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[140px]">${it.name} (x${it.quantity || 1})</span>`;
    }).join(' ');

    card.innerHTML = `
      <div class="absolute top-0 left-0 bottom-0 w-1 ${stripColor}"></div>
      
      <div>
        <!-- Customer Header -->
        <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-xl ${hasBalance ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'} flex items-center justify-center font-bold text-sm shrink-0">
              <i class="fa-solid fa-user-tag"></i>
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-sm text-slate-900 truncate">${k.customerName}</h4>
              <div class="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                <i class="fa-solid fa-phone text-slate-400 text-[10px]"></i>
                <span>${k.phone || 'No Phone'}</span>
              </div>
            </div>
          </div>

          <!-- Customer Balance Badge -->
          <div class="text-right shrink-0">
            <span class="text-[9px] uppercase tracking-wider font-bold text-slate-400 block leading-none mb-0.5">Customer Balance</span>
            <span class="font-mono font-bold text-sm ${hasBalance ? 'text-rose-600 bg-rose-50 border border-rose-200' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'} px-2 py-0.5 rounded-lg inline-block">
              Rs. ${(k.customerBalance || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <!-- 4-Grid Financial Breakdown: Total Amount, Amount Received, Amount Due, Pending Payment -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center my-2.5">
          <div class="p-1">
            <span class="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block leading-tight">Total Amount</span>
            <b class="text-xs font-mono font-bold text-slate-800">Rs. ${(k.totalAmount || 0).toLocaleString()}</b>
          </div>
          <div class="p-1 border-l border-slate-200">
            <span class="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block leading-tight">Amount Received</span>
            <b class="text-xs font-mono font-bold text-emerald-600">Rs. ${(k.amountReceived || 0).toLocaleString()}</b>
          </div>
          <div class="p-1 border-l border-slate-200">
            <span class="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block leading-tight">Amount Due</span>
            <b class="text-xs font-mono font-bold ${hasBalance ? 'text-rose-600' : 'text-slate-600'}">Rs. ${(k.amountDue || 0).toLocaleString()}</b>
          </div>
          <div class="p-1 border-l border-slate-200">
            <span class="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block leading-tight">Pending Payment</span>
            <b class="text-xs font-mono font-bold ${hasBalance ? 'text-amber-600' : 'text-emerald-600'}">Rs. ${(k.pendingPayment || 0).toLocaleString()}</b>
          </div>
        </div>

        <!-- Items Sold Preview Strip -->
        <div class="space-y-1.5 text-xs">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-500 font-semibold flex items-center gap-1">
              <i class="fa-solid fa-basket-shopping text-slate-400 text-[10px]"></i>
              <span>Items Sold (${(k.itemsSold || []).length}):</span>
            </span>
            <button onclick="openSalesStatementModal('${k.id}')" class="text-[10px] text-blue-600 hover:text-blue-800 font-semibold hover:underline">View All</button>
          </div>
          <div class="flex flex-wrap gap-1">
            ${itemsPreview || '<span class="text-[10px] text-slate-400 italic">No itemized sales yet</span>'}
          </div>
        </div>

        <!-- Due Items Alert (if any unpaid) -->
        ${hasBalance && dueItemsCount > 0 ? `
          <div class="mt-2.5 p-2 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-[11px]">
            <div class="flex items-center gap-1.5 text-amber-800 font-semibold truncate pr-1">
              <i class="fa-solid fa-clock-rotate-left text-amber-600"></i>
              <span class="truncate">Due Items: ${k.dueItems.map(i => `${i.itemName} (x${i.quantity})`).slice(0, 2).join(', ')}${dueItemsCount > 2 ? ` +${dueItemsCount - 2} more` : ''}</span>
            </div>
            <button onclick="openDueItemsModal('${k.id}')" class="text-[10px] font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-2 py-0.5 rounded shrink-0">View (${dueItemsCount})</button>
          </div>
        ` : ''}
      </div>

      <!-- Action Buttons Row -->
      <div class="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
        <div class="flex items-center gap-1">
          ${canAddKhata ? `
            <!-- + Credit Sale -->
            <button type="button" onclick="openNewCreditSaleModal('${k.id}')" title="Make New Credit Sale for this customer" class="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer">
              <i class="fa-solid fa-cart-plus text-[10px]"></i>
              <span>Credit Sale</span>
            </button>

            <!-- Receive Payment -->
            <button type="button" onclick="openKhataPaymentModal('${k.id}')" ${!hasBalance ? 'disabled class="px-2.5 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed flex items-center gap-1"' : 'class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"'} title="Record cash/bank payment from customer">
              <i class="fa-solid fa-money-bill-wave text-[10px]"></i>
              <span>Receive Pay</span>
            </button>
          ` : ''}
        </div>

        <div class="flex items-center gap-1">
          <!-- Sales Statement -->
          <button type="button" onclick="openSalesStatementModal('${k.id}')" title="View Full Sales Statement & Printable Ledger" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer">
            <i class="fa-solid fa-file-invoice text-[10px]"></i>
            <span>Statement</span>
          </button>

          <!-- Payment History -->
          <button type="button" onclick="openPaymentHistoryModal('${k.id}')" title="View Payment Receipts & History" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs transition cursor-pointer">
            <i class="fa-solid fa-receipt text-slate-600"></i>
          </button>

          ${canEditDeleteKhata ? `
            <!-- Delete Ledger -->
            <button type="button" onclick="deleteKhataConfirm('${k.id}', '${k.customerName}')" title="Delete Ledger" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs transition cursor-pointer">
              <i class="fa-solid fa-trash-can text-rose-500"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}
window.renderKhataCards = renderKhataCards;

// ==================== 1. NEW CREDIT SALE MODAL ====================

function openNewCreditSaleModal(preselectedCustomerId = null) {
  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to create credit sales.', 'error');
    return;
  }

  creditSaleItems = [];

  // Populate customer dropdown
  const custSelect = document.getElementById('csCustomerSelect');
  if (custSelect) {
    custSelect.innerHTML = '<option value="">-- Choose Existing Customer or Enter New Below --</option>';
    currentKhataList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.customerName} (${c.phone || 'No Phone'}) - Due: Rs. ${c.customerBalance.toLocaleString()}`;
      custSelect.appendChild(opt);
    });

    if (preselectedCustomerId) {
      custSelect.value = preselectedCustomerId;
      handleCreditSaleCustomerSelect();
    } else {
      document.getElementById('csCustomerName').value = '';
      document.getElementById('csCustomerPhone').value = '';
      document.getElementById('csCustomerAddress').value = '';
    }
  }

  // Pre-load items dropdown for row 0
  addCreditSaleItemRow();
  recalcCreditSaleTotals();

  openModal('modalNewCreditSale');
}
window.openNewCreditSaleModal = openNewCreditSaleModal;

function handleCreditSaleCustomerSelect() {
  const custId = document.getElementById('csCustomerSelect')?.value;
  if (!custId) return;
  const cust = currentKhataList.find(c => c.id === custId);
  if (cust) {
    document.getElementById('csCustomerName').value = cust.customerName || '';
    document.getElementById('csCustomerPhone').value = cust.phone || '';
    document.getElementById('csCustomerAddress').value = cust.address || '';
  }
}
window.handleCreditSaleCustomerSelect = handleCreditSaleCustomerSelect;

async function addCreditSaleItemRow() {
  const container = document.getElementById('csItemsContainer');
  if (!container) return;

  const rowIndex = creditSaleItems.length;
  creditSaleItems.push({
    itemId: '',
    name: '',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0
  });

  const row = document.createElement('div');
  row.className = 'grid grid-cols-12 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 items-center cs-item-row';
  row.id = `csItemRow_${rowIndex}`;

  row.innerHTML = `
    <div class="col-span-5 sm:col-span-5">
      <label class="block text-[10px] text-slate-500 font-semibold mb-0.5">Item Name / Product</label>
      <input type="text" id="csItemName_${rowIndex}" oninput="updateCreditSaleRow(${rowIndex})" placeholder="Type item name..." class="w-full p-2 bg-white border border-slate-200 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500">
    </div>
    <div class="col-span-3 sm:col-span-2">
      <label class="block text-[10px] text-slate-500 font-semibold mb-0.5">Qty</label>
      <input type="number" id="csItemQty_${rowIndex}" min="1" value="1" oninput="updateCreditSaleRow(${rowIndex})" class="w-full p-2 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-emerald-500">
    </div>
    <div class="col-span-4 sm:col-span-2">
      <label class="block text-[10px] text-slate-500 font-semibold mb-0.5">Unit Price</label>
      <input type="number" id="csItemPrice_${rowIndex}" min="0" value="0" oninput="updateCreditSaleRow(${rowIndex})" class="w-full p-2 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-right focus:outline-none focus:ring-1 focus:ring-emerald-500">
    </div>
    <div class="col-span-10 sm:col-span-2 text-right">
      <span class="block text-[10px] text-slate-400 font-semibold mb-0.5">Total</span>
      <b id="csItemTotal_${rowIndex}" class="text-xs font-mono font-bold text-slate-800 block p-2">Rs. 0</b>
    </div>
    <div class="col-span-2 sm:col-span-1 text-center">
      <span class="block text-[10px] text-transparent mb-0.5">.</span>
      <button type="button" onclick="removeCreditSaleItemRow(${rowIndex})" class="p-2 text-rose-500 hover:text-rose-700 transition" title="Remove item">
        <i class="fa-solid fa-trash-can text-xs"></i>
      </button>
    </div>
  `;

  container.appendChild(row);
}
window.addCreditSaleItemRow = addCreditSaleItemRow;

function removeCreditSaleItemRow(index) {
  const row = document.getElementById(`csItemRow_${index}`);
  if (row) row.remove();
  creditSaleItems[index] = null;
  recalcCreditSaleTotals();
}
window.removeCreditSaleItemRow = removeCreditSaleItemRow;

function updateCreditSaleRow(index) {
  const name = document.getElementById(`csItemName_${index}`)?.value || '';
  const qty = Number(document.getElementById(`csItemQty_${index}`)?.value) || 1;
  const price = Number(document.getElementById(`csItemPrice_${index}`)?.value) || 0;
  const total = qty * price;

  const totalEl = document.getElementById(`csItemTotal_${index}`);
  if (totalEl) totalEl.textContent = `Rs. ${total.toLocaleString()}`;

  if (creditSaleItems[index]) {
    creditSaleItems[index].name = name;
    creditSaleItems[index].quantity = qty;
    creditSaleItems[index].unitPrice = price;
    creditSaleItems[index].totalPrice = total;
  }

  recalcCreditSaleTotals();
}
window.updateCreditSaleRow = updateCreditSaleRow;

function recalcCreditSaleTotals() {
  const activeItems = creditSaleItems.filter(i => i !== null && i.name.trim() !== '');
  const totalAmount = activeItems.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);

  const totInput = document.getElementById('csTotalAmount');
  if (totInput) totInput.value = totalAmount;

  const receivedInput = document.getElementById('csAmountReceived');
  const amountReceived = Number(receivedInput?.value) || 0;
  const amountDue = Math.max(0, totalAmount - amountReceived);

  const dueInput = document.getElementById('csAmountDue');
  if (dueInput) dueInput.value = amountDue;

  const dueBadge = document.getElementById('csDuePreviewBadge');
  if (dueBadge) dueBadge.textContent = `Amount Due / Pending: Rs. ${amountDue.toLocaleString()}`;
}
window.recalcCreditSaleTotals = recalcCreditSaleTotals;

async function submitNewCreditSale(e) {
  e.preventDefault();

  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to create credit sales.', 'error');
    return;
  }

  const customerId = document.getElementById('csCustomerSelect')?.value || '';
  const customerName = document.getElementById('csCustomerName')?.value || '';
  const phone = document.getElementById('csCustomerPhone')?.value || '';
  const address = document.getElementById('csCustomerAddress')?.value || '';

  if (!customerName.trim() || !phone.trim()) {
    showToast('Customer name and phone number are required', 'error');
    return;
  }

  const validItems = creditSaleItems.filter(i => i !== null && i.name && i.name.trim() !== '');
  if (validItems.length === 0) {
    showToast('Please add at least one item sold on credit', 'error');
    return;
  }

  const totalAmount = Number(document.getElementById('csTotalAmount')?.value) || 0;
  const amountReceived = Number(document.getElementById('csAmountReceived')?.value) || 0;
  const amountDue = Math.max(0, totalAmount - amountReceived);
  const paymentMethod = document.getElementById('csPaymentMethod')?.value || 'Cash';
  const notes = document.getElementById('csNotes')?.value || '';

  const btn = document.getElementById('btnSubmitCreditSale');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving Credit Sale...</span>';
  }

  try {
    const res = await api('/api/khata/credit-sale', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        customerName,
        phone,
        address,
        items: validItems,
        totalAmount,
        amountReceived,
        amountDue,
        paymentMethod,
        notes
      })
    });

    showToast(res.message, 'success');
    closeModal('modalNewCreditSale');
    loadKhataList();
    if (typeof loadDashboardData === 'function') loadDashboardData();

    // Print Receipt preview
    if (res.sale && res.shop) {
      renderPrintableCreditSaleTicket(res.sale, res.shop);
      openModal('modalReceipt');
    }
  } catch (err) {
    showToast(err.message || 'Failed to record credit sale', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save Credit Sale</span>';
    }
  }
}
window.submitNewCreditSale = submitNewCreditSale;

// ==================== 2. RECEIVE KHATA PAYMENT MODAL ====================

function openKhataPaymentModal(khataId) {
  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to record Khata payments.', 'error');
    return;
  }

  const cust = currentKhataList.find(c => c.id === khataId);
  if (!cust) return;

  selectedKhataCustomer = cust;
  document.getElementById('kpKhataId').value = cust.id;
  document.getElementById('kpCustomerName').textContent = cust.customerName;
  document.getElementById('kpCustomerPhone').textContent = cust.phone;
  document.getElementById('kpCustomerBalance').textContent = `Rs. ${(cust.customerBalance || 0).toLocaleString()}`;
  document.getElementById('kpAmount').value = cust.customerBalance || 0;
  document.getElementById('kpDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('kpNotes').value = 'Counter cash installment payment';

  openModal('modalKhataPayment');
}
window.openKhataPaymentModal = openKhataPaymentModal;

async function submitKhataPayment(e) {
  e.preventDefault();
  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to record Khata payments.', 'error');
    return;
  }
  const khataId = document.getElementById('kpKhataId')?.value;
  const amount = Number(document.getElementById('kpAmount')?.value);
  const paymentMethod = document.getElementById('kpPaymentMethod')?.value || 'Cash';
  const date = document.getElementById('kpDate')?.value;
  const notes = document.getElementById('kpNotes')?.value;

  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount received', 'error');
    return;
  }

  const btn = document.getElementById('btnSubmitKhataPayment');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Processing Payment...</span>';
  }

  try {
    const res = await api(`/api/khata/${khataId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod, date, notes })
    });

    showToast(res.message, 'success');
    closeModal('modalKhataPayment');
    loadKhataList();
    if (typeof loadDashboardData === 'function') loadDashboardData();

    // Print Payment Voucher Slip
    renderPrintableKhataPaymentSlip(selectedKhataCustomer, amount, paymentMethod, res.receiptNo, res.shop);
    openModal('modalReceipt');
  } catch (err) {
    showToast(err.message || 'Payment processing failed', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Receive & Record Payment</span>';
    }
  }
}
window.submitKhataPayment = submitKhataPayment;

// ==================== 3. SALES STATEMENT MODAL ====================

let currentStatementData = null;

async function openSalesStatementModal(khataId) {
  try {
    const res = await api(`/api/khata/${khataId}/statement`);
    currentStatementData = res;

    const cust = res.customer;
    document.getElementById('stmtCustomerName').textContent = cust.customerName;
    document.getElementById('stmtCustomerPhone').textContent = cust.phone;
    document.getElementById('stmtCustomerAddress').textContent = cust.address || 'Address: N/A';
    document.getElementById('stmtDate').textContent = res.statementDate;

    // Summary Boxes
    document.getElementById('stmtCustomerBalance').textContent = `Rs. ${(cust.customerBalance || 0).toLocaleString()}`;
    document.getElementById('stmtTotalAmount').textContent = `Rs. ${(cust.totalAmount || 0).toLocaleString()}`;
    document.getElementById('stmtAmountReceived').textContent = `Rs. ${(cust.amountReceived || 0).toLocaleString()}`;
    document.getElementById('stmtAmountDue').textContent = `Rs. ${(cust.amountDue || 0).toLocaleString()}`;

    // Statement Table Rows
    const tbody = document.getElementById('stmtTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      if (!res.statement || res.statement.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">No transactions recorded for this customer</td></tr>';
      } else {
        res.statement.forEach(row => {
          const isCredit = row.type === 'Credit';
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 text-xs';

          const itemsText = (row.itemsSold && row.itemsSold.length > 0)
            ? row.itemsSold.map(i => `<span class="font-bold text-slate-800">${i.name}</span> <span class="text-slate-400 font-mono">(x${i.quantity})</span>`).join(', ')
            : `<span class="text-slate-500">${row.notes || '-'}</span>`;

          tr.innerHTML = `
            <td class="p-2.5 font-mono text-slate-600 whitespace-nowrap">${row.date}</td>
            <td class="p-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">${row.refNo}</td>
            <td class="p-2.5 whitespace-nowrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isCredit ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                ${isCredit ? 'Credit Sale' : 'Payment Received'}
              </span>
            </td>
            <td class="p-2.5 max-w-xs truncate">${itemsText}</td>
            <td class="p-2.5 font-mono font-bold text-right text-slate-800">Rs. ${Number(row.totalAmount || 0).toLocaleString()}</td>
            <td class="p-2.5 font-mono font-bold text-right text-emerald-600">Rs. ${Number(row.amountReceived || 0).toLocaleString()}</td>
            <td class="p-2.5 font-mono font-bold text-right ${isCredit && row.amountDue > 0 ? 'text-rose-600' : 'text-slate-500'}">Rs. ${Number(row.amountDue || 0).toLocaleString()}</td>
            <td class="p-2.5 font-mono font-bold text-right text-slate-900 bg-slate-50">Rs. ${Number(row.runningBalance || 0).toLocaleString()}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Due Items Table inside Statement
    const dueContainer = document.getElementById('stmtDueItemsList');
    if (dueContainer) {
      dueContainer.innerHTML = '';
      if (!res.dueItems || res.dueItems.length === 0) {
        dueContainer.innerHTML = '<p class="text-emerald-700 text-xs font-semibold py-2">✓ No pending items due! Customer balance is fully clear.</p>';
      } else {
        res.dueItems.forEach(it => {
          const d = document.createElement('div');
          d.className = 'flex items-center justify-between p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs';
          d.innerHTML = `
            <div>
              <span class="font-bold text-slate-800">${it.itemName}</span>
              <span class="text-slate-400 font-mono ml-2">Qty: ${it.quantity}</span>
              <span class="text-slate-400 text-[10px] ml-2 font-mono">(${it.invoiceNo} • ${it.date})</span>
            </div>
            <span class="font-mono font-bold text-rose-700">Due: Rs. ${it.totalPrice.toLocaleString()}</span>
          `;
          dueContainer.appendChild(d);
        });
      }
    }

    openModal('modalSalesStatement');
  } catch (err) {
    showToast(err.message || 'Error generating sales statement', 'error');
  }
}
window.openSalesStatementModal = openSalesStatementModal;

function printCustomerSalesStatement() {
  if (!currentStatementData) return;
  renderPrintableStatementSheet(currentStatementData);
  openModal('modalReceipt');
}
window.printCustomerSalesStatement = printCustomerSalesStatement;

// ==================== 4. PAYMENT HISTORY MODAL ====================

function openPaymentHistoryModal(khataId) {
  const cust = currentKhataList.find(c => c.id === khataId);
  if (!cust) return;

  document.getElementById('phCustomerName').textContent = cust.customerName;
  document.getElementById('phCustomerPhone').textContent = cust.phone;
  document.getElementById('phTotalReceived').textContent = `Rs. ${(cust.amountReceived || 0).toLocaleString()}`;

  const tbody = document.getElementById('phTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    const payments = cust.paymentHistory || [];
    if (payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">No payment receipts found for this customer</td></tr>';
    } else {
      payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs';
        tr.innerHTML = `
          <td class="p-2.5 font-mono text-slate-600">${p.date}</td>
          <td class="p-2.5 font-mono font-semibold text-slate-700">${p.receiptNo}</td>
          <td class="p-2.5 font-mono font-bold text-emerald-700">Rs. ${(p.amount || p.amountReceived || 0).toLocaleString()}</td>
          <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">${p.paymentMethod || 'Cash'}</span></td>
          <td class="p-2.5 font-mono text-slate-500">Rs. ${(p.balanceAfter || 0).toLocaleString()}</td>
          <td class="p-2.5 text-slate-500">${p.description || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  openModal('modalPaymentHistory');
}
window.openPaymentHistoryModal = openPaymentHistoryModal;

// ==================== 5. DUE ITEMS MODAL ====================

function openDueItemsModal(khataId) {
  const cust = currentKhataList.find(c => c.id === khataId);
  if (!cust) return;

  document.getElementById('dueItemsTitle').textContent = `Due Items for: ${cust.customerName} (${cust.phone})`;
  renderDueItemsTable(cust.dueItems || []);
  openModal('modalDueItems');
}
window.openDueItemsModal = openDueItemsModal;

async function openAllDueItemsModal() {
  try {
    const res = await api('/api/khata/due-items/all');
    document.getElementById('dueItemsTitle').textContent = `All Due Items Across Shop (${res.totalCount || 0} Pending Products)`;
    renderDueItemsTable(res.dueItems || []);
    openModal('modalDueItems');
  } catch (e) {
    showToast(e.message, 'error');
  }
}
window.openAllDueItemsModal = openAllDueItemsModal;

function renderDueItemsTable(items) {
  const tbody = document.getElementById('dueItemsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400 font-semibold">✓ No due items pending! All credit sales have been fully paid.</td></tr>';
    return;
  }

  items.forEach(it => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 hover:bg-slate-50 text-xs';
    tr.innerHTML = `
      <td class="p-2.5 font-bold text-slate-800">${it.itemName}</td>
      <td class="p-2.5 font-mono font-bold text-center text-slate-700">${it.quantity}</td>
      <td class="p-2.5 font-mono text-right text-slate-600">Rs. ${(it.unitPrice || 0).toLocaleString()}</td>
      <td class="p-2.5 font-mono font-bold text-right text-slate-900">Rs. ${(it.totalPrice || 0).toLocaleString()}</td>
      <td class="p-2.5 font-semibold text-slate-800">${it.customerName} <span class="text-[10px] text-slate-400 font-mono block">${it.phone}</span></td>
      <td class="p-2.5 font-mono text-slate-500">${it.invoiceNo}</td>
      <td class="p-2.5 font-mono text-slate-500">${it.date}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==================== 6. ADD CUSTOMER / DELETE KHATA ====================

function openNewKhataModal() {
  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to add Khata customers.', 'error');
    return;
  }

  document.getElementById('newKhataName').value = '';
  document.getElementById('newKhataPhone').value = '';
  document.getElementById('newKhataAddress').value = '';
  document.getElementById('newKhataInitialBalance').value = '0';
  document.getElementById('newKhataNotes').value = '';
  openModal('modalAddKhataCustomer');
}
window.openNewKhataModal = openNewKhataModal;

async function submitAddKhataCustomer(e) {
  e.preventDefault();
  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.add')) {
    showToast('Permission denied: You do not have permission to add Khata customers.', 'error');
    return;
  }

  const customerName = document.getElementById('newKhataName').value;
  const phone = document.getElementById('newKhataPhone').value;
  const address = document.getElementById('newKhataAddress').value;
  const amount = Number(document.getElementById('newKhataInitialBalance').value) || 0;
  const description = document.getElementById('newKhataNotes').value;

  try {
    const res = await api('/api/khata', {
      method: 'POST',
      body: JSON.stringify({
        customerName,
        phone,
        address,
        amount,
        type: 'Credit',
        description: description || 'Initial opening balance'
      })
    });

    showToast('Customer Khata created successfully', 'success');
    closeModal('modalAddKhataCustomer');
    loadKhataList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.submitAddKhataCustomer = submitAddKhataCustomer;

async function deleteKhataConfirm(khataId, customerName) {
  if (typeof hasPerm === 'function' && !hasPerm('expensesKhata.editDelete')) {
    showToast('Permission denied: You do not have permission to delete Khata ledgers.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete the credit khata ledger for "${customerName}"? This action cannot be undone.`)) return;

  try {
    const res = await api(`/api/khata/${khataId}`, { method: 'DELETE' });
    showToast(res.message || 'Khata ledger deleted', 'success');
    loadKhataList();
    if (typeof loadDashboardData === 'function') loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.deleteKhataConfirm = deleteKhataConfirm;

// ==================== THERMAL & SLIP PRINT TEMPLATES ====================

function renderPrintableCreditSaleTicket(sale, shop) {
  const container = document.getElementById('printableReceiptArea');
  if (!container) return;

  window.currentReceiptData = {
    type: 'credit_sale',
    sale: sale,
    shop: shop,
    invoiceNo: sale.invoiceNo
  };

  const invoiceBadge = document.getElementById('receiptInvoiceBadge');
  if (invoiceBadge) invoiceBadge.textContent = sale.invoiceNo;

  const shopName = shop?.name || "Dewan Mobile";
  const shopPhone = shop?.phone || "0300-1234567";
  const shopAddress = shop?.address || "Main Market, Dewan Mobile Shop";

  let itemsHtml = (sale.items || []).map(it => `
    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
      <span style="font-weight: 600;">${it.name} x${it.quantity}</span>
      <span style="font-family: monospace;">Rs. ${Number(it.totalPrice).toLocaleString()}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 800; margin: 0;">${shopName}</h2>
      <p style="font-size: 11px; margin: 2px 0; color: #475569;">Customer Credit Sale Voucher (ادھار رسید)</p>
      <p style="font-size: 10px; margin: 0;">${shopAddress} | Phone: ${shopPhone}</p>
    </div>

    <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 6px 0; text-align: center;">
      <span style="font-size: 10px; display: block;">Invoice #:</span>
      <b style="font-size: 16px; font-family: monospace;">${sale.invoiceNo}</b>
    </div>

    <div style="font-size: 11px; space-y: 2px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Date:</span>
        <b>${sale.date}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Customer:</span>
        <b>${sale.customerName}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Contact:</span>
        <span style="font-family: monospace;">${sale.customerPhone || '-'}</span>
      </div>
    </div>

    <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px;">
      <b style="font-size: 10px; text-transform: uppercase;">Items Sold on Credit:</b>
      ${itemsHtml}
    </div>

    <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 11px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Total Amount:</span>
        <b>Rs. ${Number(sale.totalAmount).toLocaleString()}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Amount Received:</span>
        <b>Rs. ${Number(sale.amountPaid || 0).toLocaleString()}</b>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px;">
        <span>Amount Due (Pending):</span>
        <span>Rs. ${Number(sale.dueAmount || 0).toLocaleString()}</span>
      </div>
    </div>

    <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 4px; font-size: 9px; color: #475569;">
      <p style="margin: 0;">Please clear your pending balance on due time.</p>
      <p style="margin: 2px 0 0; font-weight: bold;">Dewan Mobile POS & ERP</p>
    </div>
  `;
}

function renderPrintableKhataPaymentSlip(customer, amount, method, receiptNo, shop) {
  const container = document.getElementById('printableReceiptArea');
  if (!container) return;

  const invoiceBadge = document.getElementById('receiptInvoiceBadge');
  if (invoiceBadge) invoiceBadge.textContent = receiptNo;

  const shopName = shop?.name || "Dewan Mobile";
  const shopPhone = shop?.phone || "0300-1234567";

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 800; margin: 0;">${shopName}</h2>
      <p style="font-size: 11px; margin: 2px 0; color: #475569;">Cash Payment Receipt (وصولی رسید)</p>
      <p style="font-size: 10px; margin: 0;">Phone: ${shopPhone}</p>
    </div>

    <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 6px 0; text-align: center;">
      <span style="font-size: 10px; display: block;">Receipt #:</span>
      <b style="font-size: 16px; font-family: monospace;">${receiptNo}</b>
    </div>

    <div style="font-size: 11px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Date:</span>
        <b>${new Date().toISOString().split('T')[0]}</b>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Customer:</span>
        <b>${customer.customerName}</b>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Phone:</span>
        <span style="font-family: monospace;">${customer.phone || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>Payment Method:</span>
        <b>${method}</b>
      </div>
    </div>

    <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 6px; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between;">
      <span>Amount Received:</span>
      <span>Rs. ${Number(amount).toLocaleString()}</span>
    </div>

    <div style="text-align: center; margin-top: 10px; border-top: 1px dashed #000; padding-top: 4px; font-size: 9px; color: #475569;">
      <p style="margin: 0;">Payment received and updated in your ledger.</p>
      <p style="margin: 2px 0 0; font-weight: bold;">Thank you for your payment!</p>
    </div>
  `;
}

function renderPrintableStatementSheet(data) {
  const container = document.getElementById('printableReceiptArea');
  if (!container) return;

  const invoiceBadge = document.getElementById('receiptInvoiceBadge');
  if (invoiceBadge) invoiceBadge.textContent = 'STATEMENT';

  const shopName = data.shop?.name || "Dewan Mobile";
  const shopPhone = data.shop?.phone || "0300-1234567";
  const cust = data.customer;

  let rowsHtml = (data.statement || []).map(r => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9px;">
      <td style="padding: 3px 2px;">${r.date}</td>
      <td style="padding: 3px 2px;">${r.refNo}</td>
      <td style="padding: 3px 2px;">${r.type}</td>
      <td style="padding: 3px 2px; text-align: right;">Rs. ${r.totalAmount.toLocaleString()}</td>
      <td style="padding: 3px 2px; text-align: right;">Rs. ${r.amountReceived.toLocaleString()}</td>
      <td style="padding: 3px 2px; text-align: right; font-weight: bold;">Rs. ${r.runningBalance.toLocaleString()}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 6px;">
      <h2 style="font-size: 15px; font-weight: 800; margin: 0;">${shopName}</h2>
      <p style="font-size: 10px; margin: 1px 0;">Customer Sales Statement (کھاتہ اسٹیٹمنٹ)</p>
      <p style="font-size: 9px; margin: 0;">Phone: ${shopPhone}</p>
    </div>

    <div style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 6px 0; font-size: 10px;">
      <div>Customer: <b>${cust.customerName}</b> (${cust.phone})</div>
      <div>Date: ${data.statementDate}</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-top: 4px;">
      <thead>
        <tr style="border-bottom: 1px solid #000; font-size: 9px; font-weight: bold;">
          <th style="text-align: left; padding: 2px;">Date</th>
          <th style="text-align: left; padding: 2px;">Ref</th>
          <th style="text-align: left; padding: 2px;">Type</th>
          <th style="text-align: right; padding: 2px;">Total</th>
          <th style="text-align: right; padding: 2px;">Recv</th>
          <th style="text-align: right; padding: 2px;">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div style="border-top: 1px solid #000; margin-top: 6px; padding-top: 4px; font-size: 11px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Total Credit Sales:</span>
        <b>Rs. ${Number(cust.totalAmount).toLocaleString()}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Total Amount Received:</span>
        <b>Rs. ${Number(cust.amountReceived).toLocaleString()}</b>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 12px; border-top: 1px solid #000; padding-top: 2px; margin-top: 2px;">
        <span>Customer Balance Due:</span>
        <span>Rs. ${Number(cust.customerBalance).toLocaleString()}</span>
      </div>
    </div>
  `;
}
