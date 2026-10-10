const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { requireAuth, requireAdmin, requirePermission, hasPermission } = require('../auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'items');

// Helper to save base64 image to public/uploads/items
function saveBase64Image(dataString) {
  if (!dataString || typeof dataString !== 'string') return '';
  if (!dataString.startsWith('data:image/')) return dataString; // Already a URL or relative path

  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const matches = dataString.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return '';

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';

    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `item_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/items/${filename}`;
  } catch (err) {
    console.error('Error saving image:', err);
    return '';
  }
}

// GET /api/items (Search, category filter, stock check)
router.get('/', requireAuth, requirePermission('inventory.view'), (req, res) => {
  const { category, search, lowStock } = req.query;
  const database = db.get();
  let items = [...database.items];

  // Filter by category
  if (category && category !== 'All') {
    items = items.filter(i => i.category === category);
  }

  // Filter by search (name, urduName, barcode, subcategory)
  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    items = items.filter(i => 
      (i.name && i.name.toLowerCase().includes(q)) ||
      (i.urduName && i.urduName.includes(q)) ||
      (i.barcode && i.barcode.toLowerCase().includes(q)) ||
      (i.subCategory && i.subCategory.toLowerCase().includes(q))
    );
  }

  // Filter low stock
  if (lowStock === 'true') {
    items = items.filter(i => i.category !== 'Services' && i.stockQuantity <= i.minAlertQuantity);
  }

  // If user is a salesman, STRICTLY hide costPrice!
  const isSalesman = req.user.role === 'salesman';
  const sanitizedItems = items.map(item => {
    const copy = { ...item };
    if (isSalesman) {
      delete copy.costPrice; // Hidden from salesman!
    }
    return copy;
  });

  return res.json({ items: sanitizedItems });
});

// GET /api/items/barcode/:code (Quick scanner lookup)
router.get('/barcode/:code', requireAuth, requirePermission('inventory.view'), (req, res) => {
  const code = req.params.code.trim();
  const database = db.get();
  const item = database.items.find(i => i.barcode === code);
  if (!item) {
    return res.status(404).json({ error: 'Barcode not found (Item not found)' });
  }

  const copy = { ...item };
  if (req.user.role === 'salesman') {
    delete copy.costPrice;
  }
  return res.json({ item: copy });
});

// GET /api/items/categories (Fetch all inventory categories)
router.get('/categories', requireAuth, requirePermission('inventory.view'), (req, res) => {
  const database = db.get();
  if (!database.categories || !Array.isArray(database.categories)) {
    database.categories = [
      { id: 'cat_accessories', name: 'Accessories', urduName: 'Accessories', isSystem: true, color: 'blue' },
      { id: 'cat_spareparts', name: 'Spare Parts', urduName: 'Spare Parts', isSystem: true, color: 'amber' },
      { id: 'cat_sheets', name: 'Sheets & Skins', urduName: 'Sheets & Skins', isSystem: true, color: 'purple' },
      { id: 'cat_services', name: 'Services', urduName: 'Services', isSystem: true, color: 'emerald' }
    ];
    db.save();
  }

  // Include any categories present in items that might not be in database.categories
  const existingNames = new Set(database.categories.map(c => c.name.toLowerCase()));
  let hasNew = false;
  database.items.forEach(item => {
    if (item.category && !existingNames.has(item.category.toLowerCase())) {
      database.categories.push({
        id: 'cat_' + Date.now() + Math.random().toString(36).substring(2, 6),
        name: item.category,
        urduName: item.category,
        isSystem: false,
        color: 'indigo'
      });
      existingNames.add(item.category.toLowerCase());
      hasNew = true;
    }
  });

  if (hasNew) {
    db.save();
  }

  return res.json({ categories: database.categories });
});

// POST /api/items/categories (Create new category - Add/Edit Stock permission)
router.post('/categories', requireAuth, requirePermission('inventory.manage'), (req, res) => {
  const { name, urduName, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmedName = name.trim();
  const database = db.get();
  if (!database.categories || !Array.isArray(database.categories)) {
    database.categories = [
      { id: 'cat_accessories', name: 'Accessories', urduName: 'Accessories', isSystem: true, color: 'blue' },
      { id: 'cat_spareparts', name: 'Spare Parts', urduName: 'Spare Parts', isSystem: true, color: 'amber' },
      { id: 'cat_sheets', name: 'Sheets & Skins', urduName: 'Sheets & Skins', isSystem: true, color: 'purple' },
      { id: 'cat_services', name: 'Services', urduName: 'Services', isSystem: true, color: 'emerald' }
    ];
  }

  // Duplicate check
  const duplicate = database.categories.find(c => 
    c.name.toLowerCase() === trimmedName.toLowerCase() ||
    (urduName && c.urduName && c.urduName.trim().toLowerCase() === urduName.trim().toLowerCase())
  );

  if (duplicate) {
    return res.status(400).json({ error: 'Category already exists' });
  }

  const newCat = {
    id: 'cat_' + Date.now(),
    name: trimmedName,
    urduName: urduName && urduName.trim() ? urduName.trim() : trimmedName,
    isSystem: false,
    color: color || 'indigo',
    createdAt: new Date().toISOString()
  };

  database.categories.push(newCat);
  db.save();

  return res.status(201).json({
    message: `Category "${newCat.name}" added successfully`,
    category: newCat,
    categories: database.categories
  });
});

// PUT /api/items/categories/:id (Update / Edit category - Add/Edit Stock permission)
router.put('/categories/:id', requireAuth, requirePermission('inventory.manage'), (req, res) => {
  const { name, urduName, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const trimmedName = name.trim();
  const database = db.get();
  if (!database.categories) return res.status(404).json({ error: 'Category not found' });

  const catIndex = database.categories.findIndex(c => c.id === req.params.id);
  if (catIndex === -1) return res.status(404).json({ error: 'Category not found' });

  const cat = database.categories[catIndex];
  const oldName = cat.name;

  // Check duplicate with another category
  const duplicate = database.categories.find(c => 
    c.id !== req.params.id && c.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    return res.status(400).json({ error: `Category "${trimmedName}" already exists` });
  }

  // Update category properties
  cat.name = trimmedName;
  if (urduName !== undefined) {
    cat.urduName = urduName.trim() || trimmedName;
  }
  if (color) {
    cat.color = color;
  }
  cat.updatedAt = new Date().toISOString();

  // If category name changed, update all items belonging to this category
  let updatedItemsCount = 0;
  if (oldName !== trimmedName && database.items && Array.isArray(database.items)) {
    database.items.forEach(item => {
      if (item.category === oldName) {
        item.category = trimmedName;
        updatedItemsCount++;
      }
    });
  }

  db.save();

  return res.json({
    message: `Category "${cat.name}" updated successfully${updatedItemsCount > 0 ? ` (${updatedItemsCount} items updated)` : ''}`,
    category: cat,
    categories: database.categories,
    updatedItemsCount
  });
});

// DELETE /api/items/categories/:id (Delete category - Delete Stock permission)
router.delete('/categories/:id', requireAuth, requirePermission('inventory.delete'), (req, res) => {
  const database = db.get();
  if (!database.categories) return res.status(404).json({ error: 'Category not found' });

  const catIndex = database.categories.findIndex(c => c.id === req.params.id);
  if (catIndex === -1) return res.status(404).json({ error: 'Category not found' });

  const cat = database.categories[catIndex];
  if (cat.isSystem) {
    return res.status(400).json({ error: 'Default system category cannot be deleted' });
  }

  const itemsUsingCat = database.items.filter(i => i.category === cat.name);
  if (itemsUsingCat.length > 0) {
    return res.status(400).json({ error: `${itemsUsingCat.length} items exist in this category. Please reassign or delete them first.` });
  }

  database.categories.splice(catIndex, 1);
  db.save();

  return res.json({
    message: 'Category deleted successfully',
    categories: database.categories
  });
});

// GET /api/items/:id
router.get('/:id', requireAuth, requirePermission('inventory.view'), (req, res) => {
  const database = db.get();
  const item = database.items.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const copy = { ...item };
  if (req.user.role === 'salesman') {
    delete copy.costPrice;
  }
  return res.json({ item: copy });
});

// POST /api/items/upload-image (Upload product image)
router.post('/upload-image', requireAuth, requirePermission('inventory.manage'), (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  const savedUrl = saveBase64Image(image);
  if (!savedUrl) {
    return res.status(400).json({ error: 'Failed to save uploaded image' });
  }

  return res.json({ imageUrl: savedUrl, message: 'Image uploaded successfully' });
});

// POST /api/items (Add new item)
router.post('/', requireAuth, requirePermission('inventory.manage'), (req, res) => {
  const {
    name,
    urduName,
    category,
    subCategory,
    barcode,
    costPrice,
    salePrice,
    stockQuantity,
    minAlertQuantity,
    unit,
    shelfLocation,
    notes,
    imageUrl
  } = req.body;

  if (!name || salePrice === undefined) {
    return res.status(400).json({ error: 'Item name and sale price are required' });
  }

  const database = db.get();
  const existingBarcode = barcode ? database.items.find(i => i.barcode && i.barcode === barcode.trim()) : null;
  if (existingBarcode) {
    return res.status(400).json({ error: `This barcode already exists for: ${existingBarcode.name}` });
  }

  const processedImage = imageUrl ? (saveBase64Image(imageUrl) || imageUrl) : '';

  const newItem = {
    id: 'it_' + Date.now(),
    name: name.trim(),
    urduName: urduName ? urduName.trim() : '',
    category: category || 'Accessories',
    subCategory: subCategory ? subCategory.trim() : '',
    barcode: barcode ? barcode.trim() : Math.floor(1000000 + Math.random() * 9000000).toString(),
    costPrice: Number(costPrice) || 0,
    salePrice: Number(salePrice) || 0,
    stockQuantity: Number(stockQuantity) || 0,
    minAlertQuantity: Number(minAlertQuantity) || 3,
    unit: unit || 'Piece',
    shelfLocation: shelfLocation ? shelfLocation.trim() : '',
    imageUrl: processedImage,
    notes: notes ? notes.trim() : '',
    updatedAt: new Date().toISOString()
  };

  database.items.push(newItem);
  db.save();

  return res.status(201).json({
    message: 'Item added successfully',
    item: newItem
  });
});

// PUT /api/items/:id (Edit item)
router.put('/:id', requireAuth, requirePermission('inventory.manage'), (req, res) => {
  const database = db.get();
  const index = database.items.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const existing = database.items[index];
  const {
    name,
    urduName,
    category,
    subCategory,
    barcode,
    costPrice,
    salePrice,
    stockQuantity,
    minAlertQuantity,
    unit,
    shelfLocation,
    notes,
    imageUrl
  } = req.body;

  if (barcode && barcode !== existing.barcode) {
    const dup = database.items.find(i => i.barcode === barcode && i.id !== existing.id);
    if (dup) {
      return res.status(400).json({ error: 'This barcode is already assigned to another item' });
    }
  }

  let processedImage = existing.imageUrl || '';
  if (imageUrl !== undefined) {
    processedImage = imageUrl ? (saveBase64Image(imageUrl) || imageUrl) : '';
  }

  database.items[index] = {
    ...existing,
    name: name !== undefined ? name.trim() : existing.name,
    urduName: urduName !== undefined ? urduName.trim() : existing.urduName,
    category: category !== undefined ? category : existing.category,
    subCategory: subCategory !== undefined ? subCategory.trim() : existing.subCategory,
    barcode: barcode !== undefined ? barcode.trim() : existing.barcode,
    costPrice: costPrice !== undefined ? Number(costPrice) : existing.costPrice,
    salePrice: salePrice !== undefined ? Number(salePrice) : existing.salePrice,
    stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : existing.stockQuantity,
    minAlertQuantity: minAlertQuantity !== undefined ? Number(minAlertQuantity) : existing.minAlertQuantity,
    unit: unit !== undefined ? unit : existing.unit,
    shelfLocation: shelfLocation !== undefined ? shelfLocation.trim() : existing.shelfLocation,
    imageUrl: processedImage,
    notes: notes !== undefined ? notes.trim() : existing.notes,
    updatedAt: new Date().toISOString()
  };

  db.save();
  return res.json({
    message: 'Item updated successfully',
    item: database.items[index]
  });
});

// DELETE /api/items/:id (Delete item)
router.delete('/:id', requireAuth, requirePermission('inventory.delete'), (req, res) => {
  const database = db.get();
  const index = database.items.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const deleted = database.items.splice(index, 1)[0];
  db.save();

  return res.json({
    message: `Item deleted: ${deleted.name}`,
    deletedId: deleted.id
  });
});

// POST /api/items/adjust-stock (Quick stock addition/deduction)
router.post('/adjust-stock', requireAuth, requirePermission('inventory.manage'), (req, res) => {
  const { itemId, changeQuantity, reason } = req.body;
  if (!itemId || changeQuantity === undefined) {
    return res.status(400).json({ error: 'Please enter item and quantity' });
  }

  const database = db.get();
  const item = database.items.find(i => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  item.stockQuantity += Number(changeQuantity);
  if (item.stockQuantity < 0) item.stockQuantity = 0;
  item.updatedAt = new Date().toISOString();
  db.save();

  return res.json({
    message: `Stock updated successfully. New balance: ${item.stockQuantity}`,
    item
  });
});

module.exports = router;
