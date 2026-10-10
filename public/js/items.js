// Dewan Mobile POS - Inventory & Stock Management Module

let isLowStockOnly = false;
let currentItemsList = [];
let appCategories = [];
let categoryModalCaller = null;

// ==================== CATEGORIES MANAGEMENT ====================

// Fetch categories from backend and populate dropdowns & POS
async function loadCategories() {
  try {
    const res = await api('/api/items/categories');
    appCategories = res.categories || [];
    populateCategoryDropdowns();
    if (typeof renderPosCategories === 'function') {
      renderPosCategories();
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

// Populate both Stock filter and Add/Edit Item modal category dropdowns
function populateCategoryDropdowns() {
  // 1. Stock Filter Dropdown
  const filterSelect = document.getElementById('itemsCategoryFilter');
  if (filterSelect) {
    const currentVal = filterSelect.value || 'All';
    let filterHtml = '<option value="All">All Categories</option>';
    appCategories.forEach(cat => {
      const label = cat.name;
      filterHtml += `<option value="${cat.name}">${label}</option>`;
    });
    // Options to edit or add category directly from filter dropdown
    filterHtml += '<option value="__EDIT_CATEGORIES__" class="font-bold text-blue-700 bg-blue-50">✏️ Edit Any Category...</option>';
    filterHtml += '<option value="__NEW_CATEGORY__" class="font-bold text-emerald-700 bg-emerald-50">➕ Add New Category...</option>';
    filterSelect.innerHTML = filterHtml;
    // Restore previous selection if valid
    if (currentVal !== '__NEW_CATEGORY__' && currentVal !== '__EDIT_CATEGORIES__' && (currentVal === 'All' || appCategories.some(c => c.name === currentVal))) {
      filterSelect.value = currentVal;
    } else {
      filterSelect.value = 'All';
    }
  }

  // 2. Quick Edit Selector in Modal
  const quickEditSelect = document.getElementById('quickEditCatSelect');
  if (quickEditSelect) {
    let quickHtml = '<option value="">-- Choose Category to Edit --</option>';
    appCategories.forEach(cat => {
      const urdu = cat.urduName && cat.urduName !== cat.name ? ` (${cat.urduName})` : '';
      quickHtml += `<option value="${cat.id}">${cat.name}${urdu}</option>`;
    });
    quickEditSelect.innerHTML = quickHtml;
  }

  // 3. Add / Edit Item Modal Category Dropdown
  const modalSelect = document.getElementById('modalItemCategory');
  if (modalSelect) {
    const currentModalVal = modalSelect.value;
    let modalHtml = '';
    appCategories.forEach(cat => {
      const label = cat.name;
      modalHtml += `<option value="${cat.name}">${label}</option>`;
    });
    // Add New Category option at bottom
    modalHtml += '<option value="__NEW__" class="font-bold text-emerald-700 bg-emerald-50">➕ Add New Category...</option>';
    modalSelect.innerHTML = modalHtml;
    if (currentModalVal && appCategories.some(c => c.name === currentModalVal)) {
      modalSelect.value = currentModalVal;
    } else if (appCategories.length > 0) {
      modalSelect.value = appCategories[0].name;
    }
  }

  updateEditCategoryButtonLabel();
}

// Update the label of the Edit Category button based on filter selection
function updateEditCategoryButtonLabel() {
  const filterSelect = document.getElementById('itemsCategoryFilter');
  const btnLabel = document.getElementById('lblBtnEditCategory');
  if (!filterSelect || !btnLabel) return;

  const currentVal = filterSelect.value;
  if (currentVal && currentVal !== 'All' && currentVal !== '__NEW_CATEGORY__' && currentVal !== '__EDIT_CATEGORIES__') {
    btnLabel.textContent = `Edit "${currentVal}"`;
  } else {
    btnLabel.textContent = 'Edit Category';
  }
}

// Category filter select change handler
function handleCategoryFilterChange(selectEl) {
  if (selectEl.value === '__NEW_CATEGORY__') {
    selectEl.value = 'All';
    openNewCategoryModal(false);
    updateEditCategoryButtonLabel();
    return;
  }
  if (selectEl.value === '__EDIT_CATEGORIES__') {
    selectEl.value = 'All';
    handleEditCategoryClick();
    updateEditCategoryButtonLabel();
    return;
  }
  updateEditCategoryButtonLabel();
  loadItemsTable();
}

// Click handler for Edit Category button in the Stock Controls bar
function handleEditCategoryClick() {
  const filterSelect = document.getElementById('itemsCategoryFilter');
  const selectedCatName = filterSelect ? filterSelect.value : 'All';

  openNewCategoryModal(false);

  // If a specific category was selected in the filter, start editing it immediately
  if (selectedCatName && selectedCatName !== 'All' && selectedCatName !== '__NEW_CATEGORY__' && selectedCatName !== '__EDIT_CATEGORIES__') {
    const cat = appCategories.find(c => c.name === selectedCatName);
    if (cat) {
      startEditCategory(cat.id);
    }
  } else {
    // If 'All' was selected, highlight the quick edit selector so user can pick any category
    setTimeout(() => {
      const qSelect = document.getElementById('quickEditCatSelect');
      if (qSelect) qSelect.focus();
    }, 150);
  }
}

// Modal category select change handler
function handleModalCategoryChange(selectEl) {
  if (selectEl.value === '__NEW__') {
    openNewCategoryModal(true);
  }
}

// Open New Category Modal
function openNewCategoryModal(fromItemModal = false) {
  if (typeof hasPerm === 'function' && !hasPerm('inventory.manage')) {
    showToast('Permission denied: You do not have permission to manage categories.', 'error');
    return;
  }

  categoryModalCaller = fromItemModal ? 'modalItem' : null;

  cancelEditCategory();
  renderCategoryManagerList();
  openModal('modalNewCategory');

  setTimeout(() => {
    const nameInput = document.getElementById('newCatName');
    if (nameInput) nameInput.focus();
  }, 100);
}

// Close Category Modal
function closeCategoryModal() {
  cancelEditCategory();
  closeModal('modalNewCategory');
  // If opened from Add/Edit item modal, ensure item modal stays visible
  if (categoryModalCaller === 'modalItem') {
    openModal('modalItem');
    const modalSelect = document.getElementById('modalItemCategory');
    if (modalSelect && modalSelect.value === '__NEW__') {
      modalSelect.value = appCategories[0]?.name || 'Accessories';
    }
  }
  categoryModalCaller = null;
}

// Start Editing a Specific Category
function startEditCategory(catId) {
  const cat = appCategories.find(c => c.id === catId);
  if (!cat) return;

  const editIdInput = document.getElementById('editCatId');
  const nameInput = document.getElementById('newCatName');
  const urduInput = document.getElementById('newCatUrduName');
  const qSelect = document.getElementById('quickEditCatSelect');
  const modeTitle = document.getElementById('formCatModeTitle');
  const cancelBtn = document.getElementById('btnCancelEditCat');
  const submitBtn = document.getElementById('btnSaveCategory');
  const submitText = document.getElementById('btnSaveCategoryText');
  const submitIcon = document.getElementById('btnSaveCategoryIcon');

  if (editIdInput) editIdInput.value = cat.id;
  if (nameInput) nameInput.value = cat.name;
  if (urduInput) urduInput.value = cat.urduName || '';
  if (qSelect) qSelect.value = cat.id;

  // Set color radio
  const colorRadio = document.querySelector(`input[name="catColor"][value="${cat.color || 'emerald'}"]`);
  if (colorRadio) colorRadio.checked = true;

  // Switch form UI to Edit Mode
  if (modeTitle) {
    modeTitle.innerHTML = `<i class="fa-solid fa-pen-to-square text-blue-600 text-sm"></i> <span class="text-blue-900 font-bold">Edit Category: "${cat.name}"</span>`;
  }
  if (cancelBtn) cancelBtn.classList.remove('hidden');

  if (submitBtn) {
    submitBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
    submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
  }
  if (submitText) submitText.textContent = 'Update Category';
  if (submitIcon) {
    submitIcon.className = 'fa-solid fa-floppy-disk';
  }

  // Ensure modal is open and focus input
  openModal('modalNewCategory');
  if (nameInput) {
    nameInput.focus();
    nameInput.select();
  }
}

// Cancel Edit Mode and revert to Add Mode
function cancelEditCategory() {
  const editIdInput = document.getElementById('editCatId');
  const nameInput = document.getElementById('newCatName');
  const urduInput = document.getElementById('newCatUrduName');
  const qSelect = document.getElementById('quickEditCatSelect');
  const modeTitle = document.getElementById('formCatModeTitle');
  const cancelBtn = document.getElementById('btnCancelEditCat');
  const submitBtn = document.getElementById('btnSaveCategory');
  const submitText = document.getElementById('btnSaveCategoryText');
  const submitIcon = document.getElementById('btnSaveCategoryIcon');

  if (editIdInput) editIdInput.value = '';
  if (nameInput) nameInput.value = '';
  if (urduInput) urduInput.value = '';
  if (qSelect) qSelect.value = '';

  const defaultRadio = document.querySelector('input[name="catColor"][value="emerald"]');
  if (defaultRadio) defaultRadio.checked = true;

  if (modeTitle) {
    modeTitle.innerHTML = `<i class="fa-solid fa-plus-circle text-emerald-600 text-sm"></i> <span>Add New Category</span>`;
  }
  if (cancelBtn) cancelBtn.classList.add('hidden');

  if (submitBtn) {
    submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    submitBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
  }
  if (submitText) submitText.textContent = 'Save Category';
  if (submitIcon) {
    submitIcon.className = 'fa-solid fa-check';
  }
}

// Render existing categories list inside modal
function renderCategoryManagerList() {
  const container = document.getElementById('categoryItemsList');
  const countEl = document.getElementById('catTotalCount');
  if (countEl) countEl.textContent = `${appCategories.length} Categories`;
  if (!container) return;

  if (appCategories.length === 0) {
    container.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs">No categories found</div>';
    return;
  }

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  container.innerHTML = '';
  appCategories.forEach(cat => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex items-center justify-between p-2.5 hover:bg-slate-50 transition text-xs border-b border-slate-100 last:border-b-0';

    const badgeCls = colorClasses[cat.color] || colorClasses.indigo;
    const itemsCount = (currentItemsList || []).filter(i => i.category === cat.name).length;

    itemDiv.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${badgeCls} whitespace-nowrap">
          ${cat.name}
        </span>
        ${cat.urduName && cat.urduName !== cat.name ? `<span class="text-[11px] text-slate-400 truncate">${cat.urduName}</span>` : ''}
        ${cat.isSystem ? '<span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-medium">System</span>' : ''}
        <span class="text-[10px] text-slate-400 font-mono">(${itemsCount} items)</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" onclick="startEditCategory('${cat.id}')" title="Edit this Category" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 transition shadow-2xs">
          <i class="fa-solid fa-pen-to-square text-blue-600"></i>
          <span>Edit</span>
        </button>
        ${!cat.isSystem ? `
          <button type="button" onclick="deleteCategoryConfirm('${cat.id}', '${cat.name}')" title="Delete Category" class="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(itemDiv);
  });
}

// Save New Category or Update Existing Category
async function handleSaveCategory(e) {
  e.preventDefault();
  const editCatId = document.getElementById('editCatId')?.value;
  const nameInput = document.getElementById('newCatName');
  const urduInput = document.getElementById('newCatUrduName');
  const colorInput = document.querySelector('input[name="catColor"]:checked');
  const submitBtn = document.getElementById('btnSaveCategory');

  const name = nameInput?.value.trim();
  const urduName = urduInput?.value.trim();
  const color = colorInput?.value || 'emerald';

  if (!name) {
    showToast('Please enter category name', 'error');
    return;
  }

  const isEditing = Boolean(editCatId);

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${isEditing ? 'Updating...' : 'Saving...'}`;
  }

  try {
    let res;
    if (isEditing) {
      // UPDATE CATEGORY via PUT
      res = await api(`/api/items/categories/${editCatId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, urduName, color })
      });
    } else {
      // CREATE CATEGORY via POST
      res = await api('/api/items/categories', {
        method: 'POST',
        body: JSON.stringify({ name, urduName, color })
      });
    }

    showToast(res.message, 'success');
    await loadCategories();

    // If caller was item modal, auto-select this category
    if (categoryModalCaller === 'modalItem') {
      const modalSelect = document.getElementById('modalItemCategory');
      if (modalSelect && res.category) {
        modalSelect.value = res.category.name;
      }
      closeModal('modalNewCategory');
      openModal('modalItem');
      categoryModalCaller = null;
    } else {
      cancelEditCategory();
      renderCategoryManagerList();
    }

    loadItemsTable();
    if (typeof loadPosCatalog === 'function') {
      loadPosCatalog();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      const isStillEditing = Boolean(document.getElementById('editCatId')?.value);
      submitBtn.innerHTML = isStillEditing 
        ? '<i id="btnSaveCategoryIcon" class="fa-solid fa-floppy-disk"></i><span id="btnSaveCategoryText">Update Category</span>'
        : '<i id="btnSaveCategoryIcon" class="fa-solid fa-check"></i><span id="btnSaveCategoryText">Save Category</span>';
    }
  }
}

// Delete Category confirmation
async function deleteCategoryConfirm(catId, catName) {
  if (!confirm(`Are you sure you want to delete category "${catName}"?`)) return;

  try {
    const res = await api(`/api/items/categories/${catId}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    await loadCategories();
    renderCategoryManagerList();
    loadItemsTable();
    if (typeof loadPosCatalog === 'function') {
      loadPosCatalog();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Helper to render dynamic category badge in Stock Table
function getCategoryBadge(categoryName) {
  const cat = appCategories.find(c => c.name === categoryName);
  const label = cat ? cat.name : (categoryName || '-');
  const color = cat?.color || 'slate';

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    amber: 'bg-amber-100 text-amber-800',
    purple: 'bg-purple-100 text-purple-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    rose: 'bg-rose-100 text-rose-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    slate: 'bg-slate-100 text-slate-800'
  };

  const badgeCls = colorClasses[color] || colorClasses.slate;
  return `<span class="${badgeCls} px-2 py-0.5 rounded text-[10px] font-semibold">${label}</span>`;
}

// ==================== INVENTORY TABLE & CRUD ====================

async function loadItemsTable() {
  if (appCategories.length === 0) {
    await loadCategories();
  }

  const search = document.getElementById('itemsSearchInput')?.value || '';
  const category = document.getElementById('itemsCategoryFilter')?.value || 'All';
  const tableBody = document.getElementById('itemsTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Loading inventory...</td></tr>';

  try {
    let url = `/api/items?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
    if (isLowStockOnly) {
      url += '&lowStock=true';
    }

    const res = await api(url);
    currentItemsList = res.items || [];
    renderItemsTable();
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-500">Error: ${err.message}</td></tr>`;
  }
}

function toggleLowStockFilter() {
  isLowStockOnly = !isLowStockOnly;
  const btn = document.getElementById('btnFilterLowStock');
  if (btn) {
    if (isLowStockOnly) {
      btn.className = 'px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white border border-rose-600 flex items-center gap-1.5';
    } else {
      btn.className = 'px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-1.5';
    }
  }
  loadItemsTable();
}

function renderItemsTable() {
  const tableBody = document.getElementById('itemsTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  const isAdmin = state.user && state.user.role === 'admin';
  const canManageInv = isAdmin || (typeof hasPerm === 'function' && hasPerm('inventory.manage'));
  const canDeleteInv = isAdmin || (typeof hasPerm === 'function' && hasPerm('inventory.delete'));
  const canAnyAction = canManageInv || canDeleteInv;

  const thItemsAction = document.getElementById('thItemsAction');
  if (thItemsAction) thItemsAction.classList.toggle('hidden', !canAnyAction);

  if (currentItemsList.length === 0) {
    const colSpan = 6 + (isAdmin ? 1 : 0) + (canAnyAction ? 1 : 0);
    tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="p-8 text-center text-slate-400">No items found</td></tr>`;
    return;
  }

  currentItemsList.forEach(item => {
    const isOutOfStock = item.category !== 'Services' && item.stockQuantity <= 0;
    const isLowStock = item.category !== 'Services' && item.stockQuantity <= item.minAlertQuantity;

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 transition ${isOutOfStock ? 'bg-rose-50/30' : isLowStock ? 'bg-amber-50/20' : ''}`;

    const categoryBadge = getCategoryBadge(item.category);

    tr.innerHTML = `
      <td class="p-3 font-mono text-slate-500 text-[11px]">${item.barcode || '-'}</td>
      <td class="p-3">
        <div class="flex items-center gap-2.5">
          ${item.imageUrl ? `
            <img src="${item.imageUrl}" alt="${item.name}" onclick="openItemPhotoFullView('${item.id}')" title="Click to view full photo" class="w-10 h-10 rounded-lg object-contain border border-slate-200 flex-shrink-0 bg-slate-50 cursor-pointer hover:border-emerald-500 hover:scale-105 transition">
          ` : `
            <div class="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0 text-xs border border-slate-200">
              <i class="fa-solid fa-image"></i>
            </div>
          `}
          <div>
            <div class="font-bold text-slate-800 text-xs">${item.name}</div>
            ${item.subCategory ? `<span class="text-[10px] text-slate-400">${item.subCategory}</span>` : ''}
          </div>
        </div>
      </td>
      <td class="p-3">${categoryBadge}</td>
      ${isAdmin ? `
        <td class="p-3 font-bold text-slate-600 font-mono admin-only">
          Rs. ${(item.costPrice || 0).toLocaleString()}
        </td>
      ` : ''}
      <td class="p-3 font-bold text-emerald-700 font-mono">
        Rs. ${(item.salePrice || 0).toLocaleString()}
      </td>
      <td class="p-3">
        ${item.category !== 'Services' ? `
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-xs font-mono ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-800'}">
              ${item.stockQuantity}
            </span>
            ${isOutOfStock ? '<span class="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded">Out of Stock</span>' :
              isLowStock ? '<span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">Low Stock</span>' : ''}
          </div>
        ` : '<span class="text-xs text-emerald-600 font-semibold">Unlimited</span>'}
      </td>
      <td class="p-3 text-slate-500 text-xs">${item.shelfLocation || '-'}</td>
      ${canAnyAction ? `
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            ${canManageInv ? `
              <button onclick="openEditItemModal('${item.id}')" title="Edit Item" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button onclick="quickStockPrompt('${item.id}', '${item.name}', ${item.stockQuantity})" title="Adjust Stock" class="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">
                <i class="fa-solid fa-plus-minus"></i>
              </button>
            ` : ''}
            ${canDeleteInv ? `
              <button onclick="deleteItemConfirm('${item.id}', '${item.name}')" title="Delete Item" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            ` : ''}
          </div>
        </td>
      ` : ''}
    `;

    tableBody.appendChild(tr);
  });
}

async function openAddItemModal() {
  if (typeof hasPerm === 'function' && !hasPerm('inventory.manage')) {
    showToast('Permission denied: You do not have permission to add stock items.', 'error');
    return;
  }

  if (appCategories.length === 0) {
    await loadCategories();
  } else {
    populateCategoryDropdowns();
  }

  document.getElementById('modalItemTitle').textContent = 'Add New Inventory Item';
  document.getElementById('modalItemId').value = '';
  document.getElementById('modalItemName').value = '';
  document.getElementById('modalItemUrduName').value = '';
  document.getElementById('modalItemCategory').value = appCategories[0]?.name || 'Accessories';
  document.getElementById('modalItemSubCategory').value = '';
  document.getElementById('modalItemBarcode').value = Math.floor(1000000 + Math.random() * 9000000).toString();
  document.getElementById('modalItemCostPrice').value = '';
  document.getElementById('modalItemSalePrice').value = '';
  document.getElementById('modalItemQuantity').value = '10';
  document.getElementById('modalItemMinAlert').value = '3';
  document.getElementById('modalItemShelf').value = '';
  removeItemPhoto();
  openModal('modalItem');
}

async function openEditItemModal(itemId) {
  if (typeof hasPerm === 'function' && !hasPerm('inventory.manage')) {
    showToast('Permission denied: You do not have permission to edit stock items.', 'error');
    return;
  }

  if (appCategories.length === 0) {
    await loadCategories();
  } else {
    populateCategoryDropdowns();
  }

  const item = currentItemsList.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('modalItemTitle').textContent = `Edit Item: ${item.name}`;
  document.getElementById('modalItemId').value = item.id;
  document.getElementById('modalItemName').value = item.name || '';
  document.getElementById('modalItemUrduName').value = item.urduName || '';
  document.getElementById('modalItemCategory').value = item.category || 'Accessories';
  document.getElementById('modalItemSubCategory').value = item.subCategory || '';
  document.getElementById('modalItemBarcode').value = item.barcode || '';
  document.getElementById('modalItemCostPrice').value = item.costPrice !== undefined ? item.costPrice : '';
  document.getElementById('modalItemSalePrice').value = item.salePrice || '';
  document.getElementById('modalItemQuantity').value = item.stockQuantity || 0;
  document.getElementById('modalItemMinAlert').value = item.minAlertQuantity || 3;
  document.getElementById('modalItemShelf').value = item.shelfLocation || '';
  
  if (item.imageUrl) {
    setItemPhotoPreview(item.imageUrl);
  } else {
    removeItemPhoto();
  }

  openModal('modalItem');
}

function handleItemImageSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size exceeds 5MB limit', 'error');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    setItemPhotoPreview(dataUrl);

    try {
      const res = await api('/api/items/upload-image', {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl })
      });
      if (res && res.imageUrl) {
        document.getElementById('modalItemImageUrl').value = res.imageUrl;
      }
    } catch (err) {
      document.getElementById('modalItemImageUrl').value = dataUrl;
    }
  };
  reader.readAsDataURL(file);
}

function setItemPhotoPreview(url) {
  const img = document.getElementById('itemPhotoPreviewImg');
  const placeholder = document.getElementById('itemPhotoPlaceholder');
  const btnRemove = document.getElementById('btnRemoveItemPhoto');
  const hoverOverlay = document.getElementById('itemPhotoHoverOverlay');
  const hiddenInput = document.getElementById('modalItemImageUrl');

  if (url) {
    if (img) {
      img.src = url;
      img.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (btnRemove) btnRemove.classList.remove('hidden');
    if (hoverOverlay) hoverOverlay.classList.remove('hidden');
    if (hiddenInput) hiddenInput.value = url;
  } else {
    if (img) {
      img.src = '';
      img.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (btnRemove) btnRemove.classList.add('hidden');
    if (hoverOverlay) hoverOverlay.classList.add('hidden');
    if (hiddenInput) hiddenInput.value = '';
    const fileInput = document.getElementById('modalItemImageFile');
    if (fileInput) fileInput.value = '';
  }
}

function removeItemPhoto() {
  setItemPhotoPreview('');
}

async function handleSaveItem(e) {
  e.preventDefault();
  const itemId = document.getElementById('modalItemId').value;

  const payload = {
    name: document.getElementById('modalItemName').value,
    urduName: document.getElementById('modalItemUrduName').value,
    category: document.getElementById('modalItemCategory').value,
    subCategory: document.getElementById('modalItemSubCategory').value,
    barcode: document.getElementById('modalItemBarcode').value,
    costPrice: document.getElementById('modalItemCostPrice').value,
    salePrice: document.getElementById('modalItemSalePrice').value,
    stockQuantity: document.getElementById('modalItemQuantity').value,
    minAlertQuantity: document.getElementById('modalItemMinAlert').value,
    shelfLocation: document.getElementById('modalItemShelf').value,
    imageUrl: document.getElementById('modalItemImageUrl')?.value || ''
  };

  try {
    let res;
    if (itemId) {
      res = await api(`/api/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      res = await api('/api/items', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    showToast(res.message, 'success');
    closeModal('modalItem');
    loadItemsTable();
    if (typeof loadPosCatalog === 'function') {
      loadPosCatalog();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function quickStockPrompt(itemId, itemName, currentStock) {
  if (typeof hasPerm === 'function' && !hasPerm('inventory.manage')) {
    showToast('Permission denied: You do not have permission to adjust stock.', 'error');
    return;
  }

  const input = prompt(`${itemName}\nCurrent Stock: ${currentStock}\nHow many units to add? (Use negative number to deduct, e.g. -2):`, '10');
  if (input === null) return;
  const num = parseInt(input, 10);
  if (isNaN(num) || num === 0) return;

  try {
    const res = await api('/api/items/adjust-stock', {
      method: 'POST',
      body: JSON.stringify({ itemId, changeQuantity: num })
    });
    showToast(res.message, 'success');
    loadItemsTable();
    if (typeof loadPosCatalog === 'function') {
      loadPosCatalog();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteItemConfirm(itemId, itemName) {
  if (typeof hasPerm === 'function' && !hasPerm('inventory.delete')) {
    showToast('Permission denied: You do not have permission to delete stock items.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete ${itemName}?`)) return;

  try {
    const res = await api(`/api/items/${itemId}`, { method: 'DELETE' });
    showToast(res.message, 'success');
    loadItemsTable();
    if (typeof loadPosCatalog === 'function') {
      loadPosCatalog();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
