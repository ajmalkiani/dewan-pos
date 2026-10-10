// Dewan Mobile POS - Mobile Repairing Management Module

let currentRepairsList = [];
let selectedRepair = null;

async function loadRepairsList() {
  const search = document.getElementById('repairsSearchInput')?.value || '';
  const status = document.getElementById('repairsStatusFilter')?.value || 'All';
  const grid = document.getElementById('repairsCardsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="col-span-full py-12 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i><p class="text-xs mt-2">Loading repair tickets...</p></div>';

  try {
    const url = `/api/repairs?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`;
    const res = await api(url);
    currentRepairsList = res.repairs || [];
    renderRepairsGrid();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500 text-xs">Error: ${err.message}</div>`;
  }
}

function renderRepairsGrid() {
  const grid = document.getElementById('repairsCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (currentRepairsList.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <i class="fa-solid fa-wrench text-3xl mb-2 text-slate-300"></i>
        <p class="text-xs font-semibold">No repair tickets found</p>
      </div>
    `;
    return;
  }

  const isAdmin = Boolean(window.state?.user && window.state.user.role === 'admin');
  const canUpdateStatus = isAdmin || (typeof hasPerm === 'function' && hasPerm('repairs.updateStatus'));
  const canDeleteRepair = isAdmin || (typeof hasPerm === 'function' && hasPerm('repairs.delete'));

  currentRepairsList.forEach(rep => {
    let statusBg = 'bg-amber-100 text-amber-800 border-amber-300';
    let statusText = 'Received';
    if (rep.status === 'InProgress') {
      statusBg = 'bg-blue-100 text-blue-800 border-blue-300';
      statusText = 'In Progress';
    } else if (rep.status === 'Repaired') {
      statusBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      statusText = 'Ready';
    } else if (rep.status === 'Delivered') {
      statusBg = 'bg-slate-100 text-slate-700 border-slate-300';
      statusText = 'Delivered';
    } else if (rep.status === 'Cancelled') {
      statusBg = 'bg-rose-100 text-rose-800 border-rose-300';
      statusText = 'Cancelled / Returned';
    }

    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover-card transition flex flex-col justify-between space-y-3';
    
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
          <span class="font-mono font-bold text-xs text-slate-700">${rep.ticketNo}</span>
          ${canUpdateStatus ? `
            <button type="button" onclick="openEditStatusModal('${rep.id}')" title="Click to Change / Edit Status" class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBg} hover:opacity-80 transition flex items-center gap-1 cursor-pointer shadow-2xs">
              <span>${statusText}</span>
              <i class="fa-solid fa-pen text-[9px] opacity-70"></i>
            </button>
          ` : `
            <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBg} shadow-2xs">
              ${statusText}
            </span>
          `}
        </div>

        <div class="mt-2.5">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-slate-900">${rep.deviceBrand} ${rep.deviceModel}</h4>
            <span class="text-[11px] font-semibold text-slate-500">${rep.faultType}</span>
          </div>
          <p class="text-xs text-slate-600 mt-1 line-clamp-2">${rep.faultDescription}</p>
        </div>

        <div class="mt-3 pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
          <div class="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div class="min-w-0 pr-1">
              <div class="font-bold text-slate-800 truncate text-xs flex items-center gap-1.5">
                <i class="fa-regular fa-user text-slate-400"></i>
                <span>${rep.customerName}</span>
              </div>
              <div class="text-slate-500 text-[11px] font-mono mt-0.5 flex items-center gap-1.5">
                <i class="fa-solid fa-phone text-slate-400"></i>
                <span>${rep.customerPhone || 'No Phone'}</span>
              </div>
            </div>
            ${isAdmin ? `
              <button type="button" onclick="openEditCustomerModal('${rep.id}')" title="Edit Customer Name & Phone (Admin Only)" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-[11px] font-bold shadow-2xs flex items-center gap-1 transition shrink-0 cursor-pointer">
                <i class="fa-solid fa-user-pen text-[10px]"></i>
                <span>Edit</span>
              </button>
            ` : ''}
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div><i class="fa-solid fa-lock mr-1 text-slate-400"></i>${rep.patternLock || 'No Lock'}</div>
            <div><i class="fa-solid fa-screwdriver mr-1 text-slate-400"></i>${rep.technicianName || 'Technician'}</div>
          </div>

          ${(rep.imei1 || rep.imei2 || rep.imei) ? `
            <div class="text-[10px] text-slate-500 font-mono bg-slate-50 p-1.5 rounded border border-slate-100 flex flex-wrap items-center gap-x-2">
              <span class="flex items-center gap-1">
                <i class="fa-solid fa-barcode text-amber-600"></i>
                <b>IMEI 1:</b> ${rep.imei1 || rep.imei || '-'}
              </span>
              ${rep.imei2 ? `
                <span class="flex items-center gap-1 text-slate-600">
                  <b>IMEI 2:</b> ${rep.imei2}
                </span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <span class="text-[10px] text-slate-400 block leading-none">Total / Due:</span>
          <span class="font-bold text-xs text-slate-800 font-mono">Rs. ${rep.finalCost}</span>
          ${rep.remainingDue > 0 ? `<span class="text-[10px] text-rose-600 font-bold font-mono"> (Due: ${rep.remainingDue})</span>` : '<span class="text-[10px] text-emerald-600 font-bold"> (Paid)</span>'}
          ${rep.personalCost !== undefined && rep.personalCost > 0 ? `
            <div class="text-[10px] text-amber-700 font-medium font-mono mt-0.5">
              <span>Personal Cost: Rs. ${Number(rep.personalCost).toLocaleString()}</span>
              ${rep.profit !== undefined ? `<span class="text-emerald-700 ml-1 font-semibold">• Profit: Rs. ${Number(rep.profit).toLocaleString()}</span>` : ''}
            </div>` : ''}
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          ${canUpdateStatus ? `
            <button type="button" onclick="openEditStatusModal('${rep.id}')" title="Edit Repair Status" class="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition">
              <i class="fa-solid fa-pen-to-square text-blue-600"></i>
              <span>Edit Status</span>
            </button>
          ` : ''}
          ${canDeleteRepair ? `
            <button type="button" onclick="deleteRepairTicketConfirm('${rep.id}', '${rep.ticketNo}')" title="Delete Repair Entry" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 text-xs transition">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          ` : ''}
          <button type="button" onclick="printRepairTicketSlip('${rep.id}')" title="Print Ticket Receipt" class="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs transition">
            <i class="fa-solid fa-print"></i>
          </button>
          <button type="button" onclick="openRepairDetailModal('${rep.id}')" class="px-2 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 transition">
            <span>Details</span>
            <i class="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Delete repair ticket confirmation and handler
async function deleteRepairTicketConfirm(repairId, ticketNo) {
  if (typeof hasPerm === 'function' && !hasPerm('repairs.delete')) {
    showToast('Permission denied: You do not have permission to delete repair entries.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete repair ticket #${ticketNo}?\nAny attached spare parts will be automatically returned to stock.`)) return;

  try {
    const res = await api(`/api/repairs/${repairId}`, { method: 'DELETE' });
    showToast(res.message || 'Repair ticket deleted successfully', 'success');
    loadRepairsList();
    if (typeof loadDashboardData === 'function') {
      loadDashboardData();
    }
  } catch (err) {
    showToast(err.message || 'Error deleting repair ticket', 'error');
  }
}
window.deleteRepairTicketConfirm = deleteRepairTicketConfirm;

function openNewRepairModal() {
  if (typeof hasPerm === 'function' && !hasPerm('repairs.add')) {
    showToast('Permission denied: You do not have permission to create repair tickets.', 'error');
    return;
  }

  document.getElementById('repCustName').value = '';
  document.getElementById('repCustPhone').value = '';
  document.getElementById('repBrand').value = '';
  document.getElementById('repModel').value = '';
  document.getElementById('repColor').value = '';
  if (document.getElementById('repImei1')) document.getElementById('repImei1').value = '';
  if (document.getElementById('repImei2')) document.getElementById('repImei2').value = '';
  document.getElementById('repFaultType').value = 'Hardware';
  document.getElementById('repPattern').value = '';
  document.getElementById('repFaultDesc').value = '';
  document.getElementById('repEstCost').value = '';
  if (document.getElementById('repPersonalCost')) {
    document.getElementById('repPersonalCost').value = '0';
  }
  document.getElementById('repAdvPaid').value = '0';
  document.getElementById('repTechName').value = 'Usman (Technician)';
  calculateNewRepairProfitPreview();
  openModal('modalNewRepair');
}

function calculateNewRepairProfitPreview() {
  const estCost = Number(document.getElementById('repEstCost')?.value) || 0;
  const personalCost = Number(document.getElementById('repPersonalCost')?.value) || 0;
  const profit = Math.max(0, estCost - personalCost);
  const profitElem = document.getElementById('repEstProfitPreview');
  if (profitElem) {
    profitElem.textContent = `Rs. ${profit.toLocaleString()}`;
  }
}

async function submitNewRepair(e) {
  e.preventDefault();
  if (typeof hasPerm === 'function' && !hasPerm('repairs.add')) {
    showToast('Permission denied: You do not have permission to create repair tickets.', 'error');
    return;
  }
  const imei1 = (document.getElementById('repImei1')?.value || '').trim();
  const imei2 = (document.getElementById('repImei2')?.value || '').trim();
  const payload = {
    customerName: document.getElementById('repCustName').value,
    customerPhone: document.getElementById('repCustPhone').value,
    deviceBrand: document.getElementById('repBrand').value,
    deviceModel: document.getElementById('repModel').value,
    deviceColor: document.getElementById('repColor').value,
    imei1,
    imei2,
    imei: [imei1, imei2].filter(Boolean).join(' / '),
    faultType: document.getElementById('repFaultType').value,
    patternLock: document.getElementById('repPattern').value,
    faultDescription: document.getElementById('repFaultDesc').value,
    estimatedCost: document.getElementById('repEstCost').value,
    personalCost: document.getElementById('repPersonalCost')?.value || 0,
    advancePaid: document.getElementById('repAdvPaid').value,
    technicianName: document.getElementById('repTechName').value
  };

  try {
    const res = await api('/api/repairs', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    showToast(res.message, 'success');
    closeModal('modalNewRepair');
    loadRepairsList();
    loadDashboardData();

    // Print repair ticket slip automatically
    renderPrintableRepairTicket(res.repair, res.shop);
    openModal('modalReceipt');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Repair Detail & Status Management
async function openRepairDetailModal(repairId) {
  try {
    const res = await api(`/api/repairs/${repairId}`);
    selectedRepair = res.repair;

    document.getElementById('detRepTicketNo').textContent = selectedRepair.ticketNo;
    document.getElementById('detRepCustomer').textContent = `${selectedRepair.customerName} - ${selectedRepair.customerPhone}`;
    document.getElementById('detRepModel').textContent = `${selectedRepair.deviceBrand} ${selectedRepair.deviceModel}`;
    document.getElementById('detRepFault').textContent = selectedRepair.faultDescription;
    document.getElementById('detRepFinalCost').textContent = `Rs. ${(selectedRepair.finalCost || 0).toLocaleString()}`;
    document.getElementById('detRepDue').textContent = `Rs. ${(selectedRepair.remainingDue || 0).toLocaleString()}`;

    if (document.getElementById('detRepImei1')) {
      document.getElementById('detRepImei1').textContent = selectedRepair.imei1 || selectedRepair.imei || '-';
    }
    if (document.getElementById('detRepImei2')) {
      document.getElementById('detRepImei2').textContent = selectedRepair.imei2 || '-';
    }

    const pCost = selectedRepair.personalCost || 0;
    const pProfit = selectedRepair.profit !== undefined ? selectedRepair.profit : Math.max(0, (selectedRepair.finalCost || 0) - pCost);
    if (document.getElementById('detRepPersonalCost')) {
      document.getElementById('detRepPersonalCost').textContent = `Rs. ${Number(pCost).toLocaleString()}`;
    }
    if (document.getElementById('detRepProfit')) {
      document.getElementById('detRepProfit').textContent = `Rs. ${Number(pProfit).toLocaleString()}`;
    }

    // Status Badge
    const badge = document.getElementById('detRepStatusBadge');
    badge.textContent = selectedRepair.status;

    // Reset and initialize customer edit fields (admin only)
    const isAdmin = Boolean(window.state?.user && window.state.user.role === 'admin');
    const custEditBox = document.getElementById('detRepCustomerEditBox');
    if (custEditBox) custEditBox.classList.add('hidden');
    const custToggleBtn = document.getElementById('btnToggleDetailCustomerEdit');
    if (custToggleBtn) custToggleBtn.classList.toggle('hidden', !isAdmin);

    const nameInp = document.getElementById('detRepCustomerNameInput');
    const phoneInp = document.getElementById('detRepCustomerPhoneInput');
    if (nameInp) nameInp.value = selectedRepair.customerName || '';
    if (phoneInp) phoneInp.value = selectedRepair.customerPhone || '';

    // Inputs
    document.getElementById('inpUpdStatus').value = selectedRepair.status;
    document.getElementById('inpUpdFinalCost').value = selectedRepair.finalCost;
    if (document.getElementById('inpUpdPersonalCost')) {
      document.getElementById('inpUpdPersonalCost').value = selectedRepair.personalCost || 0;
    }
    document.getElementById('inpUpdPaymentReceived').value = selectedRepair.remainingDue;

    // Render attached parts
    renderAttachedPartsList();
    loadSparePartsDropdown();

    openModal('modalRepairDetail');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleDetailCustomerEdit() {
  const box = document.getElementById('detRepCustomerEditBox');
  if (!box) return;
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden') && selectedRepair) {
    const nameInp = document.getElementById('detRepCustomerNameInput');
    const phoneInp = document.getElementById('detRepCustomerPhoneInput');
    if (nameInp) nameInp.value = selectedRepair.customerName || '';
    if (phoneInp) phoneInp.value = selectedRepair.customerPhone || '';
  }
}
window.toggleDetailCustomerEdit = toggleDetailCustomerEdit;

async function saveDetailCustomerInfo() {
  if (!window.state?.user || window.state.user.role !== 'admin') {
    showToast('Permission denied: Only administrators can edit customer details', 'error');
    return;
  }
  if (!selectedRepair) return;

  const customerName = document.getElementById('detRepCustomerNameInput')?.value;
  const customerPhone = document.getElementById('detRepCustomerPhoneInput')?.value;

  if (!customerName || !customerName.trim()) {
    showToast('Customer name is required', 'error');
    return;
  }

  const btn = document.getElementById('btnSaveDetailCustomer');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
  }

  try {
    const res = await api(`/api/repairs/${selectedRepair.id}/customer`, {
      method: 'PUT',
      body: JSON.stringify({
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.trim() : ''
      })
    });

    selectedRepair = res.repair;
    const custEl = document.getElementById('detRepCustomer');
    if (custEl) custEl.textContent = `${selectedRepair.customerName} - ${selectedRepair.customerPhone || 'No Phone'}`;
    const box = document.getElementById('detRepCustomerEditBox');
    if (box) box.classList.add('hidden');

    showToast(res.message || 'Customer details updated', 'success');
    loadRepairsList();
  } catch (err) {
    showToast(err.message || 'Failed to update customer details', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save Customer Info</span>';
    }
  }
}
window.saveDetailCustomerInfo = saveDetailCustomerInfo;

function renderAttachedPartsList() {
  const container = document.getElementById('detRepPartsList');
  if (!container) return;
  container.innerHTML = '';

  if (!selectedRepair.partsUsed || selectedRepair.partsUsed.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-[11px]">No spare parts attached yet</p>';
    return;
  }

  selectedRepair.partsUsed.forEach(p => {
    const d = document.createElement('div');
    d.className = 'flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200 text-xs';
    d.innerHTML = `
      <div>
        <span class="font-bold text-slate-800">${p.name}</span>
        <span class="text-slate-400 ml-2 font-mono">(${p.quantity} pcs)</span>
      </div>
      <span class="font-bold text-emerald-700 font-mono">Rs. ${(p.salePrice * p.quantity).toLocaleString()}</span>
    `;
    container.appendChild(d);
  });
}

async function loadSparePartsDropdown() {
  try {
    const res = await api('/api/items?category=Spare+Parts');
    const sel = document.getElementById('selPartItem');
    sel.innerHTML = '<option value="">Select Spare Part...</option>';
    (res.items || []).forEach(part => {
      const opt = document.createElement('option');
      opt.value = part.id;
      opt.textContent = `${part.name} (Available: ${part.stockQuantity}) - Rs. ${part.salePrice}`;
      sel.appendChild(opt);
    });
  } catch (e) {}
}

function toggleAttachPartForm() {
  document.getElementById('divAttachPartForm').classList.toggle('hidden');
}

async function submitAttachSparePart() {
  const partItemId = document.getElementById('selPartItem').value;
  const quantity = document.getElementById('inpPartQty').value;

  if (!partItemId) {
    showToast('Please select a spare part', 'error');
    return;
  }

  try {
    const res = await api(`/api/repairs/${selectedRepair.id}/parts`, {
      method: 'POST',
      body: JSON.stringify({ partItemId, quantity })
    });

    selectedRepair = res.repair;
    renderAttachedPartsList();
    toggleAttachPartForm();
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitUpdateRepairStatus() {
  const status = document.getElementById('inpUpdStatus').value;
  const finalCost = document.getElementById('inpUpdFinalCost').value;
  const personalCost = document.getElementById('inpUpdPersonalCost')?.value || 0;
  const remainingPaymentReceived = document.getElementById('inpUpdPaymentReceived').value;

  try {
    const res = await api(`/api/repairs/${selectedRepair.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, finalCost, personalCost, remainingPaymentReceived })
    });

    showToast(res.message, 'success');
    closeModal('modalRepairDetail');
    loadRepairsList();
    loadDashboardData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== QUICK EDIT REPAIR STATUS MODAL ====================

let currentStatusEditingRepair = null;

async function openEditStatusModal(repairId) {
  if (typeof hasPerm === 'function' && !hasPerm('repairs.updateStatus')) {
    showToast('Permission denied: You do not have permission to update repair status.', 'error');
    return;
  }

  try {
    let rep = currentRepairsList.find(r => r.id === repairId);
    if (!rep) {
      const res = await api(`/api/repairs/${repairId}`);
      rep = res.repair;
    }
    if (!rep) {
      showToast('Repair ticket not found', 'error');
      return;
    }

    currentStatusEditingRepair = rep;

    const idInput = document.getElementById('quickStatusRepairId');
    const badgeEl = document.getElementById('quickStatusTicketBadge');
    const customerEl = document.getElementById('quickStatusDeviceCustomer');
    const dueEl = document.getElementById('quickStatusDueAmount');
    const billInput = document.getElementById('quickStatusFinalBill');
    const advInput = document.getElementById('quickStatusAdvancePaid');
    const costInput = document.getElementById('quickStatusPersonalCost');
    const techInput = document.getElementById('quickStatusTechName');
    const notesInput = document.getElementById('quickStatusNotes');

    if (idInput) idInput.value = rep.id;
    if (badgeEl) badgeEl.textContent = rep.ticketNo;
    if (customerEl) {
      const imeiText = (rep.imei1 || rep.imei2 || rep.imei) ? ` • IMEI: ${[rep.imei1 || rep.imei, rep.imei2].filter(Boolean).join(' / ')}` : '';
      customerEl.textContent = `${rep.deviceBrand || ''} ${rep.deviceModel}${imeiText} • ${rep.customerName} (${rep.customerPhone || 'No Phone'})`;
    }
    if (dueEl) dueEl.textContent = `Rs. ${(rep.remainingDue || 0).toLocaleString()}`;
    
    if (billInput) billInput.value = rep.finalCost !== undefined ? rep.finalCost : (rep.estimatedCost || 0);
    if (advInput) advInput.value = `Rs. ${(rep.advancePaid || 0).toLocaleString()}`;
    if (costInput) costInput.value = rep.personalCost || 0;
    if (techInput) techInput.value = rep.technicianName || '';
    if (notesInput) notesInput.value = rep.notes || '';

    const isAdmin = Boolean(window.state?.user && window.state.user.role === 'admin');
    const custBox = document.getElementById('quickStatusAdminCustomerBox');
    if (custBox) custBox.classList.toggle('hidden', !isAdmin);

    const custNameInput = document.getElementById('quickStatusCustName');
    const custPhoneInput = document.getElementById('quickStatusCustPhone');
    if (custNameInput) custNameInput.value = rep.customerName || '';
    if (custPhoneInput) custPhoneInput.value = rep.customerPhone || '';

    // Check matching status radio button
    const radio = document.querySelector(`input[name="quickRepStatusRadio"][value="${rep.status}"]`);
    if (radio) {
      radio.checked = true;
    } else {
      const defRadio = document.querySelector(`input[name="quickRepStatusRadio"][value="Received"]`);
      if (defRadio) defRadio.checked = true;
    }

    handleStatusRadioSelection(rep.status || 'Received');
    openModal('modalEditRepairStatus');
  } catch (err) {
    showToast(err.message || 'Error loading repair ticket', 'error');
  }
}
window.openEditStatusModal = openEditStatusModal;

function handleStatusRadioSelection(statusVal) {
  const finalBill = Number(document.getElementById('quickStatusFinalBill')?.value) || (currentStatusEditingRepair?.finalCost || 0);
  const advPaid = currentStatusEditingRepair ? (Number(currentStatusEditingRepair.advancePaid) || 0) : 0;
  const remainingDue = Math.max(0, finalBill - advPaid);

  const paymentInp = document.getElementById('quickStatusPaymentReceived');
  const paymentBox = document.getElementById('quickStatusPaymentBox');
  const badgeDue = document.getElementById('badgeQuickDueStatus');

  if (badgeDue) {
    badgeDue.textContent = remainingDue > 0 ? `Remaining Due: Rs. ${remainingDue.toLocaleString()}` : 'Fully Cleared';
  }

  if (statusVal === 'Delivered') {
    // When marking delivered, pre-fill payment input with remaining due
    if (paymentInp) {
      paymentInp.value = remainingDue;
    }
    if (paymentBox) {
      paymentBox.classList.add('bg-emerald-50/80', 'border-emerald-300');
    }
  } else {
    if (paymentInp) {
      paymentInp.value = 0;
    }
    if (paymentBox) {
      paymentBox.classList.remove('bg-emerald-50/80', 'border-emerald-300');
    }
  }
}
window.handleStatusRadioSelection = handleStatusRadioSelection;

function recalcQuickStatusDue() {
  const finalBill = Number(document.getElementById('quickStatusFinalBill')?.value) || 0;
  const advPaid = currentStatusEditingRepair ? (Number(currentStatusEditingRepair.advancePaid) || 0) : 0;
  const remainingDue = Math.max(0, finalBill - advPaid);

  const dueEl = document.getElementById('quickStatusDueAmount');
  if (dueEl) dueEl.textContent = `Rs. ${remainingDue.toLocaleString()}`;

  const badgeDue = document.getElementById('badgeQuickDueStatus');
  if (badgeDue) {
    badgeDue.textContent = remainingDue > 0 ? `Remaining Due: Rs. ${remainingDue.toLocaleString()}` : 'Fully Cleared';
  }

  const selectedRadio = document.querySelector('input[name="quickRepStatusRadio"]:checked');
  if (selectedRadio && selectedRadio.value === 'Delivered') {
    const paymentInp = document.getElementById('quickStatusPaymentReceived');
    if (paymentInp) paymentInp.value = remainingDue;
  }
}
window.recalcQuickStatusDue = recalcQuickStatusDue;

async function submitQuickRepairStatus(e) {
  e.preventDefault();
  if (typeof hasPerm === 'function' && !hasPerm('repairs.updateStatus')) {
    showToast('Permission denied: You do not have permission to update repair status.', 'error');
    return;
  }
  const repairId = document.getElementById('quickStatusRepairId')?.value;
  if (!repairId) return;

  const selectedRadio = document.querySelector('input[name="quickRepStatusRadio"]:checked');
  const status = selectedRadio ? selectedRadio.value : 'Received';
  const finalCost = document.getElementById('quickStatusFinalBill')?.value;
  const personalCost = document.getElementById('quickStatusPersonalCost')?.value || 0;
  const remainingPaymentReceived = document.getElementById('quickStatusPaymentReceived')?.value || 0;
  const notes = document.getElementById('quickStatusNotes')?.value || '';
  const technicianName = document.getElementById('quickStatusTechName')?.value || '';

  const payload = {
    status,
    finalCost,
    personalCost,
    remainingPaymentReceived,
    notes,
    technicianName
  };

  // Admin-only customer fields update in quick status modal
  if (window.state?.user && window.state.user.role === 'admin') {
    const custName = document.getElementById('quickStatusCustName')?.value;
    const custPhone = document.getElementById('quickStatusCustPhone')?.value;
    if (custName !== undefined) payload.customerName = custName;
    if (custPhone !== undefined) payload.customerPhone = custPhone;
  }

  const btn = document.getElementById('btnSaveQuickStatus');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Updating...</span>';
  }

  try {
    const res = await api(`/api/repairs/${repairId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    showToast(res.message, 'success');
    closeModal('modalEditRepairStatus');
    loadRepairsList();
    loadDashboardData();
  } catch (err) {
    showToast(err.message || 'Failed to update repair status', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save Status</span>';
    }
  }
}
window.submitQuickRepairStatus = submitQuickRepairStatus;

// Dedicated Admin-Only Modal: Edit Customer Name & Phone
async function openEditCustomerModal(repairId) {
  if (!window.state?.user || window.state.user.role !== 'admin') {
    showToast('Permission denied: Only administrators can edit customer details', 'error');
    return;
  }

  let rep = currentRepairsList.find(r => r.id === repairId);
  if (!rep) {
    try {
      const res = await api(`/api/repairs/${repairId}`);
      rep = res.repair;
    } catch (e) {
      showToast('Repair ticket not found', 'error');
      return;
    }
  }
  if (!rep) return;

  const idInp = document.getElementById('custModalRepairId');
  const badgeEl = document.getElementById('custModalTicketBadge');
  const devEl = document.getElementById('custModalDeviceModel');
  const nameInp = document.getElementById('custModalCustomerName');
  const phoneInp = document.getElementById('custModalCustomerPhone');

  if (idInp) idInp.value = rep.id;
  if (badgeEl) badgeEl.textContent = rep.ticketNo;
  if (devEl) devEl.textContent = `${rep.deviceBrand || ''} ${rep.deviceModel} (Ticket #${rep.ticketNo})`;
  if (nameInp) nameInp.value = rep.customerName || '';
  if (phoneInp) phoneInp.value = rep.customerPhone || '';

  openModal('modalEditRepairCustomer');
}
window.openEditCustomerModal = openEditCustomerModal;

async function submitEditRepairCustomer(e) {
  e.preventDefault();
  if (!window.state?.user || window.state.user.role !== 'admin') {
    showToast('Permission denied: Only administrators can edit customer details', 'error');
    return;
  }

  const repairId = document.getElementById('custModalRepairId')?.value;
  const customerName = document.getElementById('custModalCustomerName')?.value;
  const customerPhone = document.getElementById('custModalCustomerPhone')?.value;

  if (!repairId) return;
  if (!customerName || !customerName.trim()) {
    showToast('Customer name is required', 'error');
    return;
  }

  const btn = document.getElementById('btnSaveRepairCustomer');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving...</span>';
  }

  try {
    const res = await api(`/api/repairs/${repairId}/customer`, {
      method: 'PUT',
      body: JSON.stringify({
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.trim() : ''
      })
    });

    showToast(res.message || 'Customer details updated successfully', 'success');
    closeModal('modalEditRepairCustomer');
    loadRepairsList();
    loadDashboardData();
  } catch (err) {
    showToast(err.message || 'Failed to update customer details', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Save Customer</span>';
    }
  }
}
window.submitEditRepairCustomer = submitEditRepairCustomer;

function printQuickStatusSlip() {
  if (currentStatusEditingRepair) {
    printRepairTicketSlip(currentStatusEditingRepair.id);
  }
}
window.printQuickStatusSlip = printQuickStatusSlip;

function printCurrentRepairTicket() {
  if (selectedRepair) {
    renderPrintableRepairTicket(selectedRepair, state.shopSettings);
    openModal('modalReceipt');
  }
}

async function printRepairTicketSlip(repairId) {
  try {
    const res = await api(`/api/repairs/${repairId}`);
    renderPrintableRepairTicket(res.repair, res.shop);
    openModal('modalReceipt');
  } catch (e) {}
}

// Thermal Print Template for Repair Job Slip
function renderPrintableRepairTicket(rep, shop) {
  const container = document.getElementById('printableReceiptArea');
  if (!container) return;

  window.currentReceiptData = {
    type: 'repair',
    repair: rep,
    shop: shop,
    invoiceNo: rep.ticketNo || 'REP-TICKET'
  };

  const invoiceBadge = document.getElementById('receiptInvoiceBadge');
  if (invoiceBadge) {
    invoiceBadge.textContent = rep.ticketNo || '';
  }

  const shopName = shop?.name || "Dewan Mobile POS";
  const shopPhone = shop?.phone || "0300-1234567";
  const shopAddress = shop?.address || "Main Market, Dewan Mobile Shop";

  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 800; margin: 0; font-family: 'Inter', sans-serif;">${shopName}</h2>
      <p style="font-size: 11px; margin: 2px 0; color: #334155;">Mobile Repairing Lab & Service Ticket</p>
      <p style="font-size: 10px; margin: 0;">${shopAddress} | Phone: ${shopPhone}</p>
    </div>

    <div style="border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px 0; margin: 8px 0; text-align: center;">
      <span style="font-size: 10px; display: block;">Job Ticket #:</span>
      <b style="font-size: 18px; font-family: monospace;">${rep.ticketNo}</b>
    </div>

    <div style="font-size: 11px; space-y: 3px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Date Received:</span>
        <b>${rep.date}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Customer Name:</span>
        <b>${rep.customerName}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Contact Phone:</span>
        <span style="font-family: monospace;">${rep.customerPhone || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Device / Model:</span>
        <b>${rep.deviceBrand} ${rep.deviceModel}</b>
      </div>
      ${(rep.imei1 || rep.imei) ? `
      <div style="display: flex; justify-content: space-between;">
        <span>IMEI 1:</span>
        <span style="font-family: monospace; font-weight: bold;">${rep.imei1 || rep.imei}</span>
      </div>` : ''}
      ${rep.imei2 ? `
      <div style="display: flex; justify-content: space-between;">
        <span>IMEI 2:</span>
        <span style="font-family: monospace; font-weight: bold;">${rep.imei2}</span>
      </div>` : ''}
      <div style="display: flex; justify-content: space-between;">
        <span>Lock / Pattern:</span>
        <b>${rep.patternLock || 'No Lock'}</b>
      </div>
      <div style="border-top: 1px dotted #cbd5e1; padding-top: 4px; margin-top: 4px;">
        <span>Fault Description:</span>
        <div style="font-weight: bold; margin-top: 2px;">${rep.faultDescription}</div>
      </div>
    </div>

    <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 11px;">
      <div style="display: flex; justify-content: space-between;">
        <span>Estimated Cost:</span>
        <b>Rs. ${rep.finalCost.toLocaleString()}</b>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Advance Paid:</span>
        <b>Rs. ${rep.advancePaid.toLocaleString()}</b>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; border-top: 1px solid #000; padding-top: 3px; margin-top: 3px;">
        <span>Remaining Due:</span>
        <span>Rs. ${rep.remainingDue.toLocaleString()}</span>
      </div>
    </div>

    <div style="text-align: center; margin-top: 12px; border-top: 1px dashed #000; padding-top: 6px; font-size: 9px; color: #475569;">
      <p style="margin: 0;">1. Mobile will only be returned upon presenting original ticket.</p>
      <p style="margin: 1px 0;">2. No warranty for dead/water-damaged devices and software flashing.</p>
      <p style="margin: 1px 0;">3. Please collect device within 15 days of repair completion.</p>
      <p style="margin: 4px 0 0; font-weight: bold;">Thank you for trusting Dewan Mobile Lab!</p>
    </div>
  `;
}
