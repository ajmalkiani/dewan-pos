// Dewan Mobile POS - Point of Sale Register Module

// Initialize POS view
async function initPosView() {
  if (typeof loadCategories === 'function' && appCategories.length === 0) {
    await loadCategories();
  }
  renderPosCategories();
  await loadPosCatalog();
  renderPosCart();
  renderPosPermissionsUI();
  setupBarcodeScannerListener();
}

// Enforce granular POS permissions on register UI
function renderPosPermissionsUI() {
  const canCreate = typeof hasPerm === 'function' ? hasPerm('pos.create') : true;
  const canDiscount = typeof hasPerm === 'function' ? hasPerm('pos.discount') : true;

  const checkoutBtn = document.getElementById('btnPosCheckout');
  if (checkoutBtn) {
    if (!canCreate) {
      checkoutBtn.disabled = true;
      checkoutBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
      checkoutBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      checkoutBtn.title = 'Checkout disabled: You do not have permission to create sales.';
      checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i><span>Checkout Blocked (No Permission)</span>';
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
      checkoutBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
      checkoutBtn.removeAttribute('title');
      checkoutBtn.innerHTML = '<i class="fa-solid fa-print"></i><span>Complete Sale & Print Receipt</span>';
    }
  }

  const discountInp = document.getElementById('posDiscount');
  if (discountInp) {
    if (!canDiscount) {
      discountInp.value = '0';
      discountInp.disabled = true;
      discountInp.classList.add('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
      discountInp.title = 'Discount disabled: Staff permission required (Apply Discount)';
    } else {
      discountInp.disabled = false;
      discountInp.classList.remove('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
      discountInp.removeAttribute('title');
    }
  }
}
window.renderPosPermissionsUI = renderPosPermissionsUI;

// Render Dynamic POS Category Tabs
function renderPosCategories() {
  const container = document.getElementById('posCategoryTabs');
  if (!container) return;
  if (!Array.isArray(appCategories) || appCategories.length === 0) return;

  const current = state.posCategory || 'All';
  let html = `<button onclick="filterPosCategory('All')" class="pos-cat-btn ${current === 'All' ? 'active' : ''} px-3 py-1.5 rounded-lg ${current === 'All' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} whitespace-nowrap">All Items</button>`;

  appCategories.forEach(cat => {
    const isActive = current === cat.name;
    const label = cat.name;
    const activeClasses = isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200';
    html += `<button onclick="filterPosCategory('${cat.name}')" class="pos-cat-btn ${isActive ? 'active' : ''} px-3 py-1.5 rounded-lg ${activeClasses} whitespace-nowrap">${label}</button>`;
  });

  container.innerHTML = html;
}

// Load Product Catalog for POS
async function loadPosCatalog() {
  try {
    const data = await api('/api/items');
    state.allPosItems = data.items || [];
    renderPosCategories();
    renderPosItemsGrid();
  } catch (err) {
    console.error('Error loading POS items:', err);
  }
}

// Filter Category
function filterPosCategory(category) {
  state.posCategory = category;
  renderPosCategories();
  renderPosItemsGrid();
}

// Search
function handlePosSearch(query) {
  state.posSearchQuery = query.trim().toLowerCase();
  renderPosItemsGrid();
}

// Render Products Grid
function renderPosItemsGrid() {
  const container = document.getElementById('posItemsGrid');
  if (!container) return;
  container.innerHTML = '';

  let filtered = [...state.allPosItems];

  // Category filter
  if (state.posCategory !== 'All') {
    filtered = filtered.filter(i => i.category === state.posCategory);
  }

  // Search filter
  if (state.posSearchQuery) {
    const q = state.posSearchQuery;
    filtered = filtered.filter(i =>
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.urduName && i.urduName.includes(q)) ||
      (i.barcode && i.barcode.toLowerCase().includes(q)) ||
      (i.subCategory && i.subCategory.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <i class="fa-solid fa-box-open text-3xl mb-2 text-slate-300"></i>
        <p class="text-xs font-semibold">No items found</p>
      </div>
    `;
    return;
  }

  filtered.forEach(item => {
    const isOutOfStock = item.category !== 'Services' && item.stockQuantity <= 0;
    const isLowStock = item.category !== 'Services' && item.stockQuantity <= item.minAlertQuantity;

    const card = document.createElement('div');
    card.className = `bg-white p-3 rounded-xl border ${isOutOfStock ? 'border-rose-200 bg-rose-50/20 opacity-75' : 'border-slate-200 hover:border-emerald-500'} shadow-sm hover-card cursor-pointer transition flex flex-col justify-between`;
    
    // Disable click if out of stock
    if (!isOutOfStock) {
      card.onclick = () => addPosItemToCart(item);
    }

    let categoryBadge = '';
    if (item.category === 'Accessories') categoryBadge = '<span class="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">Accessory</span>';
    else if (item.category === 'Spare Parts') categoryBadge = '<span class="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px]">Spare Part</span>';
    else if (item.category === 'Sheets & Skins') categoryBadge = '<span class="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">Back Sheet</span>';
    else if (item.category === 'Services') categoryBadge = '<span class="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">Service</span>';

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          ${categoryBadge}
          ${item.category !== 'Services' ? `
            <span class="text-[10px] font-bold ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-500'}">
              ${isOutOfStock ? 'Out of Stock' : `${item.stockQuantity} in stock`}
            </span>
          ` : '<span class="text-[10px] text-emerald-600 font-bold">Unlimited</span>'}
        </div>
        ${item.imageUrl ? `
          <div class="w-full h-36 mb-2 rounded-lg overflow-hidden bg-slate-100/70 border border-slate-200 flex items-center justify-center relative group/img cursor-zoom-in" onclick="event.stopPropagation(); openItemPhotoFullView('${item.id}')" title="Click to view full photo">
            <img src="${item.imageUrl}" alt="${item.name}" class="w-full h-full object-contain p-1 transition-transform duration-200 group-hover/img:scale-105">
            <div class="absolute inset-x-0 bottom-0 py-1 bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white text-[10px] font-semibold text-center opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-1.5 pointer-events-none">
              <i class="fa-solid fa-magnifying-glass-plus"></i>
              <span>Full View</span>
            </div>
            <button type="button" onclick="event.stopPropagation(); openItemPhotoFullView('${item.id}')" title="Full Screen Photo" class="absolute top-1.5 right-1.5 w-6 h-6 bg-slate-900/60 hover:bg-slate-900 text-white rounded-md flex items-center justify-center text-[10px] transition shadow">
              <i class="fa-solid fa-expand"></i>
            </button>
          </div>
        ` : ''}
        <h4 class="font-bold text-xs text-slate-900 leading-tight mb-1 line-clamp-2">${item.name}</h4>
      </div>

      <div class="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
        <span class="text-xs font-extrabold text-emerald-700 font-mono">Rs. ${item.salePrice.toLocaleString()}</span>
        <button class="w-7 h-7 rounded-lg ${isOutOfStock ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'} flex items-center justify-center text-xs shadow-sm">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

// Add Item To Cart
function addPosItemToCart(item) {
  const existing = state.posCart.find(ci => ci.itemId === item.id);

  if (existing) {
    if (item.category !== 'Services' && existing.quantity >= item.stockQuantity) {
      showToast(`Stock limit reached! Only ${item.stockQuantity} pcs available`, 'error');
      return;
    }
    existing.quantity += 1;
  } else {
    state.posCart.push({
      itemId: item.id,
      name: item.name,
      urduName: item.urduName,
      imageUrl: item.imageUrl || '',
      category: item.category,
      unitPrice: item.salePrice,
      quantity: 1,
      maxStock: item.stockQuantity,
      discount: 0
    });
  }

  playBeep();
  renderPosCart();
}

// Render Cart Items
function renderPosCart() {
  const container = document.getElementById('posCartList');
  const badge = document.getElementById('posCartBadge');
  if (!container) return;

  const totalItemsCount = state.posCart.reduce((sum, i) => sum + i.quantity, 0);
  badge.textContent = `${totalItemsCount} items`;

  if (state.posCart.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-slate-400 py-12">
        <i class="fa-solid fa-cart-plus text-4xl mb-2 text-slate-300"></i>
        <p class="text-xs font-semibold">Cart is empty</p>
        <p class="text-[11px] text-slate-400">Click items or scan barcode to add</p>
      </div>
    `;
    calculatePosTotals();
    return;
  }

  container.innerHTML = '';

  state.posCart.forEach((item, index) => {
    const lineTotal = (item.quantity * item.unitPrice) - (item.discount || 0);

    const div = document.createElement('div');
    div.className = 'pt-2 pb-2 space-y-1.5';
    div.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">
          <h5 class="font-bold text-xs text-slate-800 leading-tight">${item.name}</h5>
          <span class="text-[11px] text-slate-500 font-mono">Rs. ${item.unitPrice} × ${item.quantity}</span>
        </div>
        <div class="text-right">
          <span class="text-xs font-bold text-emerald-700 font-mono">Rs. ${lineTotal.toLocaleString()}</span>
          <button onclick="removePosCartItem(${index})" class="block text-slate-400 hover:text-rose-600 text-xs ml-auto mt-0.5">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs">
        <!-- Qty controls -->
        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          <button onclick="changePosItemQty(${index}, -1)" class="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
            <i class="fa-solid fa-minus text-[10px]"></i>
          </button>
          <span class="w-7 text-center font-bold text-slate-800 font-mono text-xs">${item.quantity}</span>
          <button onclick="changePosItemQty(${index}, 1)" class="w-6 h-6 rounded bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold">
            <i class="fa-solid fa-plus text-[10px]"></i>
          </button>
        </div>

        <!-- Custom Price Edit -->
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-slate-400">Price:</span>
          <input type="number" onchange="updatePosItemPrice(${index}, this.value)" value="${item.unitPrice}" min="0" class="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-left font-mono text-xs">
        </div>
      </div>
    `;

    container.appendChild(div);
  });

  calculatePosTotals();
  renderPosPermissionsUI();
}

function changePosItemQty(index, change) {
  const item = state.posCart[index];
  if (!item) return;

  const newQty = item.quantity + change;
  if (newQty <= 0) {
    removePosCartItem(index);
    return;
  }

  if (item.category !== 'Services' && newQty > item.maxStock) {
    showToast(`Stock limit reached! Only ${item.maxStock} pcs available`, 'error');
    return;
  }

  item.quantity = newQty;
  renderPosCart();
}

function updatePosItemPrice(index, val) {
  const num = Number(val);
  if (num >= 0 && state.posCart[index]) {
    state.posCart[index].unitPrice = num;
    renderPosCart();
  }
}

function removePosCartItem(index) {
  state.posCart.splice(index, 1);
  renderPosCart();
}

function clearPosCart() {
  state.posCart = [];
  state.selectedKhataCustomer = null;
  const disc = document.getElementById('posDiscount');
  if (disc) disc.value = '0';
  const nameInp = document.getElementById('posCustomerName');
  if (nameInp) nameInp.value = '';
  const phoneInp = document.getElementById('posCustomerPhone');
  if (phoneInp) phoneInp.value = '';
  setPosPaymentMethod('Cash');
  renderPosCart();
  renderPosKhataBanner();
}

// Helper to get total number
function getPosGrandTotalNumber() {
  let subtotal = 0;
  (state.posCart || []).forEach(i => {
    subtotal += (i.quantity * i.unitPrice) - (i.discount || 0);
  });
  const discountInp = document.getElementById('posDiscount');
  const discountVal = Number(discountInp ? discountInp.value : 0) || 0;
  return Math.max(0, subtotal - discountVal);
}

// Totals Calculation
function calculatePosTotals() {
  let subtotal = 0;
  state.posCart.forEach(i => {
    subtotal += (i.quantity * i.unitPrice) - (i.discount || 0);
  });

  const canDiscount = typeof hasPerm === 'function' ? hasPerm('pos.discount') : true;
  const discountInp = document.getElementById('posDiscount');
  let discountVal = Number(discountInp ? discountInp.value : 0) || 0;
  if (!canDiscount && discountVal > 0) {
    discountVal = 0;
    if (discountInp) discountInp.value = '0';
  }
  const grandTotal = Math.max(0, subtotal - discountVal);

  const subEl = document.getElementById('posSubtotal');
  const grandEl = document.getElementById('posGrandTotal');
  if (subEl) subEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
  if (grandEl) grandEl.textContent = `Rs. ${grandTotal.toLocaleString()}`;

  renderPosKhataBanner();
}

// Payment Method Selection
function setPosPaymentMethod(method) {
  state.selectedPaymentMethod = method;
  document.querySelectorAll('.pos-pm-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-emerald-600', 'text-white');
    btn.classList.add('bg-white', 'text-slate-700');
  });
  const btn = document.getElementById(`pm-${method}`);
  if (btn) {
    btn.classList.add('active', 'bg-emerald-600', 'text-white');
    btn.classList.remove('bg-white', 'text-slate-700');
  }

  if (method === 'Udhaar') {
    // If Khata selected and no customer chosen, automatically open Khata customer list
    if (!state.selectedKhataCustomer) {
      openPosKhataCustomerModal();
    }
  }

  renderPosKhataBanner();
}

// ==================== POS KHATA CUSTOMER LEDGER INTEGRATION ====================
let posKhataCustomersListCache = [];

// Open Khata Customer Picker Modal
async function openPosKhataCustomerModal() {
  const saleAmount = getPosGrandTotalNumber();
  const saleAmtEl = document.getElementById('posKhataModalSaleAmount');
  if (saleAmtEl) {
    saleAmtEl.textContent = `Rs. ${saleAmount.toLocaleString()}`;
  }

  const searchInp = document.getElementById('posKhataSearchInput');
  if (searchInp) searchInp.value = '';

  togglePosKhataQuickAdd(false);

  const container = document.getElementById('posKhataCustomerListContainer');
  if (container) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-600 mb-2"></i>
        <p class="text-xs font-semibold">Loading Khata customers...</p>
      </div>
    `;
  }

  openModal('modalPosKhataCustomer');

  try {
    const res = await api('/api/khata');
    posKhataCustomersListCache = res.khata || [];
    renderPosKhataCustomersModalList();
    if (searchInp) {
      setTimeout(() => searchInp.focus(), 150);
    }
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="py-8 text-center text-rose-500 text-xs font-semibold">
          <i class="fa-solid fa-circle-exclamation text-xl mb-1"></i>
          <p>Failed to load customers: ${err.message}</p>
        </div>
      `;
    }
  }
}
window.openPosKhataCustomerModal = openPosKhataCustomerModal;

// Filter Khata customers in modal
function filterPosKhataCustomers(query) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    renderPosKhataCustomersModalList();
    return;
  }
  const filtered = posKhataCustomersListCache.filter(c => {
    const nameMatch = (c.customerName || '').toLowerCase().includes(q);
    const phoneMatch = (c.phone || '').toLowerCase().includes(q);
    const addrMatch = (c.address || '').toLowerCase().includes(q);
    return nameMatch || phoneMatch || addrMatch;
  });
  renderPosKhataCustomersModalList(filtered);
}
window.filterPosKhataCustomers = filterPosKhataCustomers;

// Render Khata customers list in modal
function renderPosKhataCustomersModalList(list = null) {
  const container = document.getElementById('posKhataCustomerListContainer');
  const countEl = document.getElementById('posKhataCustomersCount');
  if (!container) return;

  const customers = list !== null ? list : posKhataCustomersListCache;
  if (countEl) {
    countEl.textContent = `${customers.length} customer${customers.length === 1 ? '' : 's'} in Khata`;
  }

  if (customers.length === 0) {
    container.innerHTML = `
      <div class="py-10 text-center text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
        <div class="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 text-xl">
          <i class="fa-solid fa-address-book"></i>
        </div>
        <p class="text-xs font-bold text-slate-700">No matching Khata customers</p>
        <p class="text-[11px] text-slate-400 mt-0.5">Click "+ New" above to add this customer directly</p>
      </div>
    `;
    return;
  }

  const saleTotal = getPosGrandTotalNumber();
  const selectedId = state.selectedKhataCustomer?.id;

  let html = '';
  customers.forEach(cust => {
    const curBal = Number(cust.customerBalance !== undefined ? cust.customerBalance : cust.balanceDue || 0);
    const projBal = curBal + saleTotal;
    const isSelected = selectedId === cust.id;
    const hasBal = curBal > 0;

    html += `
      <div onclick="selectKhataCustomerForPos('${cust.id}')" class="p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${isSelected ? 'bg-emerald-50/90 border-emerald-500 shadow-sm ring-1 ring-emerald-500' : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50'}">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : hasBal ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
            <i class="fa-solid fa-user-tag"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${cust.customerName}</h4>
              ${isSelected ? '<span class="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded">Selected</span>' : ''}
            </div>
            <div class="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
              <span><i class="fa-solid fa-phone text-[9px] text-slate-400"></i> ${cust.phone || 'No phone'}</span>
              ${cust.address ? `<span class="truncate text-slate-400">• ${cust.address}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="text-right shrink-0">
          <div class="text-[10px] text-slate-400 font-semibold uppercase">Current Balance</div>
          <div class="text-xs font-mono font-bold ${hasBal ? 'text-rose-600' : 'text-emerald-700'}">Rs. ${curBal.toLocaleString()}</div>
          ${saleTotal > 0 ? `
            <div class="text-[10px] font-mono font-extrabold text-slate-700 mt-0.5">
              New: <span class="text-rose-700">Rs. ${projBal.toLocaleString()}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}
window.renderPosKhataCustomersModalList = renderPosKhataCustomersModalList;

// Select customer from list
function selectKhataCustomerForPos(customerId) {
  const cust = posKhataCustomersListCache.find(c => c.id === customerId);
  if (!cust) return;

  state.selectedKhataCustomer = cust;
  state.selectedPaymentMethod = 'Udhaar';

  // Update payment buttons
  document.querySelectorAll('.pos-pm-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-emerald-600', 'text-white');
    btn.classList.add('bg-white', 'text-slate-700');
  });
  const udhaarBtn = document.getElementById('pm-Udhaar');
  if (udhaarBtn) {
    udhaarBtn.classList.add('active', 'bg-emerald-600', 'text-white');
    udhaarBtn.classList.remove('bg-white', 'text-slate-700');
  }

  // Fill customer input fields
  const nameInp = document.getElementById('posCustomerName');
  const phoneInp = document.getElementById('posCustomerPhone');
  if (nameInp) nameInp.value = cust.customerName || '';
  if (phoneInp) phoneInp.value = cust.phone || '';

  closeModal('modalPosKhataCustomer');
  renderPosKhataBanner();
  showToast(`Selected Khata Customer: ${cust.customerName}`, 'success');
}
window.selectKhataCustomerForPos = selectKhataCustomerForPos;

// Clear selected Khata customer
function clearPosKhataCustomer() {
  state.selectedKhataCustomer = null;
  renderPosKhataBanner();
  showToast('Khata customer unlinked', 'info');
}
window.clearPosKhataCustomer = clearPosKhataCustomer;

// Toggle quick add customer form in modal
function togglePosKhataQuickAdd(forceState) {
  const form = document.getElementById('posKhataQuickAddForm');
  const btn = document.getElementById('btnTogglePosKhataQuickAdd');
  if (!form) return;

  const willShow = forceState !== undefined ? forceState : form.classList.contains('hidden');
  if (willShow) {
    form.classList.remove('hidden');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-minus text-[11px]"></i> <span>Hide</span>';
    const nameInp = document.getElementById('quickKhataName');
    if (nameInp) setTimeout(() => nameInp.focus(), 100);
  } else {
    form.classList.add('hidden');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-user-plus text-[11px]"></i> <span>+ New</span>';
  }
}
window.togglePosKhataQuickAdd = togglePosKhataQuickAdd;

// Submit quick add customer
async function submitPosQuickAddKhataCustomer(e) {
  e.preventDefault();
  const nameInp = document.getElementById('quickKhataName');
  const phoneInp = document.getElementById('quickKhataPhone');
  const addrInp = document.getElementById('quickKhataAddress');
  const btn = document.getElementById('btnSaveQuickKhata');

  const customerName = (nameInp?.value || '').trim();
  const phone = (phoneInp?.value || '').trim();
  const address = (addrInp?.value || '').trim();

  if (!customerName || !phone) {
    showToast('Name and phone number are required', 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> Saving...';
  }

  try {
    const res = await api('/api/khata', {
      method: 'POST',
      body: JSON.stringify({
        customerName,
        phone,
        address,
        amount: 0,
        type: 'Credit',
        description: 'New customer account created from POS'
      })
    });

    const newCustomer = res.khata || {
      id: 'kh_' + Date.now(),
      customerName,
      phone,
      address,
      customerBalance: 0,
      balanceDue: 0
    };

    posKhataCustomersListCache.unshift(newCustomer);
    selectKhataCustomerForPos(newCustomer.id);

    if (nameInp) nameInp.value = '';
    if (phoneInp) phoneInp.value = '';
    if (addrInp) addrInp.value = '';
    togglePosKhataQuickAdd(false);

    showToast(`Created & selected Khata: ${customerName}`, 'success');
  } catch (err) {
    showToast(err.message || 'Error creating Khata customer', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i> <span>Save & Select Customer</span>';
    }
  }
}
window.submitPosQuickAddKhataCustomer = submitPosQuickAddKhataCustomer;

// Render selected Khata banner in POS sidebar
function renderPosKhataBanner() {
  const banner = document.getElementById('posKhataCustomerBanner');
  if (!banner) return;

  const isKhata = state.selectedPaymentMethod === 'Udhaar';
  const cust = state.selectedKhataCustomer;

  if (!isKhata && !cust) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  banner.classList.remove('hidden');

  if (cust) {
    const curBal = Number(cust.customerBalance !== undefined ? cust.customerBalance : cust.balanceDue || 0);
    const saleTotal = getPosGrandTotalNumber();
    const projBal = curBal + (isKhata ? saleTotal : 0);

    banner.innerHTML = `
      <div class="p-2.5 rounded-xl border space-y-1.5 shadow-2xs ${isKhata ? 'bg-emerald-50/90 border-emerald-300' : 'bg-slate-50 border-slate-200'}">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isKhata ? 'text-emerald-800 bg-emerald-200/70' : 'text-slate-700 bg-slate-200'} px-2 py-0.5 rounded-full">
            <i class="fa-solid fa-book-bookmark ${isKhata ? 'text-emerald-600' : 'text-slate-500'}"></i> ${isKhata ? 'Khata Ledger Credit' : 'Khata Linked'}
          </span>
          <div class="flex items-center gap-2">
            <button type="button" onclick="openPosKhataCustomerModal()" class="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 hover:underline">
              <i class="fa-solid fa-arrows-rotate text-[9px]"></i> Change
            </button>
            <button type="button" onclick="clearPosKhataCustomer()" class="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 hover:underline" title="Unlink Customer">
              <i class="fa-solid fa-xmark text-[10px]"></i>
            </button>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="min-w-0 pr-2">
            <div class="font-bold text-slate-900 text-xs truncate">${cust.customerName}</div>
            <div class="text-[11px] text-slate-500 font-mono">${cust.phone || 'No Phone'}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[10px] text-slate-500 font-medium">Balance: <span class="font-bold text-slate-800 font-mono">Rs. ${curBal.toLocaleString()}</span></div>
            ${isKhata ? `
              <div class="text-[11px] font-extrabold text-rose-700 font-mono">
                New: Rs. ${projBal.toLocaleString()} <span class="text-[9px] text-rose-500 font-normal">(+${saleTotal.toLocaleString()})</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  } else if (isKhata) {
    banner.innerHTML = `
      <div class="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs">
        <div class="flex items-center gap-2 min-w-0 pr-1">
          <i class="fa-solid fa-triangle-exclamation text-amber-600 text-sm shrink-0"></i>
          <div>
            <div class="font-bold text-[11px] leading-tight">No Khata Customer Selected</div>
            <div class="text-[10px] text-amber-700">Choose customer to add this sale to balance</div>
          </div>
        </div>
        <button type="button" onclick="openPosKhataCustomerModal()" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] shadow-xs flex items-center gap-1 shrink-0">
          <i class="fa-solid fa-user-plus text-[10px]"></i> Select
        </button>
      </div>
    `;
  }
}
window.renderPosKhataBanner = renderPosKhataBanner;

// Submit Checkout
async function submitPosCheckout() {
  if (typeof hasPerm === 'function' && !hasPerm('pos.create')) {
    showToast('Permission denied: You do not have permission to create sales.', 'error');
    return;
  }

  if (state.posCart.length === 0) {
    showToast('Cart is empty, please add items', 'error');
    return;
  }

  const isKhata = state.selectedPaymentMethod === 'Udhaar';
  if (isKhata && !state.selectedKhataCustomer) {
    showToast('Please select a Khata ledger customer for credit sale', 'error');
    openPosKhataCustomerModal();
    return;
  }

  const btn = document.getElementById('btnPosCheckout');
  let discountVal = Number(document.getElementById('posDiscount').value) || 0;
  if (typeof hasPerm === 'function' && !hasPerm('pos.discount') && discountVal > 0) {
    showToast('Permission denied: You do not have permission to apply discounts.', 'warning');
    discountVal = 0;
    const discEl = document.getElementById('posDiscount');
    if (discEl) discEl.value = '0';
  }
  const customerName = state.selectedKhataCustomer ? state.selectedKhataCustomer.customerName : document.getElementById('posCustomerName').value;
  const customerPhone = state.selectedKhataCustomer ? state.selectedKhataCustomer.phone : document.getElementById('posCustomerPhone').value;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing sale...';

  try {
    const payload = {
      items: state.posCart,
      overallDiscount: discountVal,
      paymentMethod: isKhata ? 'Udhaar' : state.selectedPaymentMethod,
      khataCustomerId: state.selectedKhataCustomer ? state.selectedKhataCustomer.id : undefined,
      customerName,
      customerPhone,
      amountPaid: isKhata ? 0 : undefined,
      notes: isKhata ? `Credit Sale to Khata: ${customerName}` : ''
    };

    const res = await api('/api/pos/checkout', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    playBeep();
    if (isKhata) {
      const newBal = res.customer ? res.customer.balanceDue : (res.sale.dueAmount || res.sale.totalAmount);
      showToast(`Sale recorded! Rs. ${res.sale.totalAmount.toLocaleString()} added to ${customerName}'s Khata (New Balance: Rs. ${newBal.toLocaleString()})`, 'success');
    } else {
      showToast('Sale completed successfully!', 'success');
    }

    // Show thermal receipt
    renderPrintableReceipt(res.sale, res.shop);
    openModal('modalReceipt');

    // Clear cart and refresh catalog & khata
    clearPosCart();
    await loadPosCatalog();
    loadDashboardData();
    if (typeof loadKhataList === 'function') {
      loadKhataList().catch(() => {});
    }

  } catch (err) {
    showToast(err.message || 'Error processing sale', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-print"></i><span>Complete Sale & Print Receipt</span>';
  }
}

// ==================== BARCODE SCANNER LISTENER ====================
let barcodeBuffer = '';
let lastKeyTime = Date.now();

function setupBarcodeScannerListener() {
  window.addEventListener('keydown', (e) => {
    // Only capture if not focused in a textarea or standard text input (except barcode search)
    const activeEl = document.activeElement;
    const isTextInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

    const currentTime = Date.now();
    if (currentTime - lastKeyTime > 150) {
      barcodeBuffer = '';
    }
    lastKeyTime = currentTime;

    if (e.key === 'Enter') {
      if (barcodeBuffer.length >= 4) {
        handleScannedBarcode(barcodeBuffer);
        barcodeBuffer = '';
        e.preventDefault();
      }
    } else if (e.key.length === 1) {
      barcodeBuffer += e.key;
    }
  });
}

async function handleScannedBarcode(code) {
  try {
    const res = await api(`/api/items/barcode/${encodeURIComponent(code)}`);
    if (res.item) {
      addPosItemToCart(res.item);
      showToast(`Added: ${res.item.name}`, 'success');
    }
  } catch (err) {
    showToast(`Barcode not found: ${code}`, 'error');
  }
}

// ==================== THERMAL RECEIPT RENDERING ====================
function renderPrintableReceipt(sale, shop) {
  const container = document.getElementById('printableReceiptArea');
  if (!container) return;

  window.currentReceiptData = {
    type: 'sale',
    sale: sale,
    shop: shop,
    invoiceNo: sale.invoiceNo || 'INV-SALE'
  };

  const invoiceBadge = document.getElementById('receiptInvoiceBadge');
  if (invoiceBadge) {
    invoiceBadge.textContent = sale.invoiceNo || '';
  }

  const shopName = shop?.name || "Dewan Mobile";
  const shopPhone = shop?.phone || "0300-1234567";
  const shopAddress = shop?.address || "Main Market, Dewan Mobile";
  const footerNote = shop?.footerNote || "Purchased items can be exchanged within 3 days with receipt.";

  let itemsHtml = '';
  sale.items.forEach(it => {
    itemsHtml += `
      <tr style="border-bottom: 1px dotted #cbd5e1;">
        <td style="padding: 4px 0; text-align: left;">
          <div style="font-weight: bold;">${it.name}</div>
          <div style="font-size: 10px; color: #475569;">${it.quantity} × Rs. ${it.unitPrice.toLocaleString()}</div>
        </td>
        <td style="padding: 4px 0; text-align: right; font-weight: bold; vertical-align: bottom;">
          Rs. ${it.totalPrice.toLocaleString()}
        </td>
      </tr>
    `;
  });

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 800; margin: 0;">${shopName}</h2>
      <p style="font-size: 11px; margin: 2px 0; color: #334155;">${shopAddress}</p>
      <p style="font-size: 11px; margin: 0; font-family: monospace;">Phone: ${shopPhone}</p>
    </div>

    <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 6px 0; font-size: 10px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Invoice: <b>${sale.invoiceNo}</b></span>
        <span>Date: ${sale.date}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 2px;">
        <span>Salesman: ${sale.salesmanName}</span>
        <span>Payment: <b>${sale.paymentMethod === 'Udhaar' ? 'Khata (Udhaar)' : sale.paymentMethod}</b></span>
      </div>
      ${sale.customerName ? `<div style="margin-top: 2px;">Customer: <b>${sale.customerName}</b> ${sale.customerPhone ? `(${sale.customerPhone})` : ''}</div>` : ''}
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0;">
      <thead>
        <tr style="border-bottom: 1px solid #000; font-size: 10px;">
          <th style="text-align: left; padding-bottom: 3px;">Item / Description</th>
          <th style="text-align: right; padding-bottom: 3px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="border-top: 1px dashed #000; padding-top: 6px; font-size: 11px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>Subtotal:</span>
        <b>Rs. ${sale.subtotal.toLocaleString()}</b>
      </div>
      ${sale.discount > 0 ? `
        <div style="display: flex; justify-content: space-between; color: #b91c1c; margin-bottom: 2px;">
          <span>Discount:</span>
          <b>- Rs. ${sale.discount.toLocaleString()}</b>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px;">
        <span>Net Total:</span>
        <span>Rs. ${sale.totalAmount.toLocaleString()}</span>
      </div>
      ${(sale.paymentMethod === 'Udhaar' || sale.dueAmount > 0) ? `
        <div style="display: flex; justify-content: space-between; color: #b91c1c; font-size: 11px; font-weight: bold; margin-top: 3px; border-top: 1px dotted #cbd5e1; padding-top: 3px;">
          <span>Added to Khata Balance:</span>
          <span>Rs. ${(sale.dueAmount || sale.totalAmount).toLocaleString()}</span>
        </div>
      ` : ''}
    </div>

    <div style="text-align: center; margin-top: 12px; padding-top: 6px; border-top: 1px dashed #000; font-size: 9px; color: #475569;">
      <p style="margin: 0;">${footerNote}</p>
      <p style="margin: 3px 0 0; font-weight: bold;">Thank you for your visit!</p>
      <p style="margin: 2px 0 0; font-size: 8px; color: #94a3b8;">Dewan Mobile POS System</p>
    </div>
  `;
}

// ==================== ITEM PHOTO FULL VIEW (DURING SALE) ====================

let currentFullViewItem = null;

async function openItemPhotoFullView(itemId) {
  let item = (state.allPosItems || []).find(i => i.id === itemId)
          || (typeof currentItemsList !== 'undefined' && Array.isArray(currentItemsList) ? currentItemsList.find(i => i.id === itemId) : null);

  if (!item) {
    try {
      const res = await api(`/api/items/${itemId}`);
      item = res.item;
    } catch (e) {
      console.error('Failed to load item for photo full view:', e);
    }
  }

  if (!item || !item.imageUrl) return;
  currentFullViewItem = item;

  const nameEl = document.getElementById('fullViewItemName');
  const catEl = document.getElementById('fullViewCategory');
  const priceEl = document.getElementById('fullViewItemPrice');
  const barcodeEl = document.getElementById('fullViewItemBarcode');
  const stockEl = document.getElementById('fullViewItemStock');
  const imgEl = document.getElementById('fullViewItemImg');
  const btnAdd = document.getElementById('btnFullViewAddToCart');

  if (nameEl) nameEl.textContent = item.name;
  if (catEl) catEl.textContent = `${item.category}${item.subCategory ? ` • ${item.subCategory}` : ''}`;
  if (priceEl) priceEl.textContent = `Rs. ${(item.salePrice || 0).toLocaleString()}`;
  if (barcodeEl) barcodeEl.textContent = item.barcode || '-';
  if (imgEl) imgEl.src = item.imageUrl;

  const isOutOfStock = item.category !== 'Services' && item.stockQuantity <= 0;
  if (stockEl) {
    if (item.category === 'Services') {
      stockEl.textContent = 'Unlimited';
      stockEl.className = 'font-bold text-xs text-emerald-600';
    } else {
      stockEl.textContent = isOutOfStock ? 'Out of Stock' : `${item.stockQuantity} in stock`;
      stockEl.className = `font-bold text-xs ${isOutOfStock ? 'text-rose-600' : 'text-slate-800'}`;
    }
  }

  if (btnAdd) {
    if (isOutOfStock) {
      btnAdd.disabled = true;
      btnAdd.className = 'px-5 py-2.5 bg-slate-200 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2 flex-1 sm:flex-none';
    } else {
      btnAdd.disabled = false;
      btnAdd.className = 'px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 flex-1 sm:flex-none';
    }
  }

  const modal = document.getElementById('modalItemPhotoFullView');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeItemPhotoFullView() {
  const modal = document.getElementById('modalItemPhotoFullView');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  currentFullViewItem = null;
}

function handleFullViewAddToCart() {
  if (currentFullViewItem) {
    addPosItemToCart(currentFullViewItem);
    closeItemPhotoFullView();
  }
}

window.openItemPhotoFullView = openItemPhotoFullView;
window.closeItemPhotoFullView = closeItemPhotoFullView;
window.handleFullViewAddToCart = handleFullViewAddToCart;

