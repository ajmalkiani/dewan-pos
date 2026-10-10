const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, requirePermission, hasPermission } = require('../auth');

// Generate Next Invoice Number
function generateInvoiceNo(salesList) {
  const currentYear = new Date().getFullYear();
  const yearSales = salesList.filter(s => s.invoiceNo && s.invoiceNo.startsWith(`DM-${currentYear}-`));
  const nextNum = yearSales.length + 1;
  return `DM-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

// POST /api/pos/checkout (Process sale from PC or Mobile phone)
router.post('/checkout', requireAuth, requirePermission('pos.create'), (req, res) => {
  const {
    items, // [{ itemId, name, quantity, unitPrice, discount }]
    customerName,
    customerPhone,
    overallDiscount,
    paymentMethod, // 'Cash', 'JazzCash', 'EasyPaisa', 'Bank', 'Udhaar'
    khataCustomerId,
    amountPaid,
    notes
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Please add items.' });
  }

  // Permission check for applying discounts
  const discountVal = Number(overallDiscount) || 0;
  const hasItemDiscount = items.some(it => Number(it.discount) > 0);
  if ((discountVal > 0 || hasItemDiscount) && !hasPermission(req.user, 'pos.discount')) {
    return res.status(403).json({ error: 'Permission denied: You do not have permission to apply discounts.' });
  }

  const database = db.get();

  // Validate stock and calculate totals
  let subtotal = 0;
  let totalCost = 0;
  const processedItems = [];

  for (const cartItem of items) {
    const itemInDb = database.items.find(i => i.id === cartItem.itemId);
    const qty = Number(cartItem.quantity) || 1;
    const price = Number(cartItem.unitPrice) || 0;
    const itemDiscount = Number(cartItem.discount) || 0;
    const lineTotal = (qty * price) - itemDiscount;

    let costPerUnit = 0;
    if (itemInDb) {
      // If physical item (not pure service), check and decrement stock
      if (itemInDb.category !== 'Services') {
        if (itemInDb.stockQuantity < qty) {
          return res.status(400).json({
            error: `Low stock! Current stock for ${itemInDb.name} is only ${itemInDb.stockQuantity} pcs.`
          });
        }
        itemInDb.stockQuantity -= qty;
        itemInDb.updatedAt = new Date().toISOString();
      }
      costPerUnit = itemInDb.costPrice || 0;
    }

    const lineCost = qty * costPerUnit;
    subtotal += (qty * price);
    totalCost += lineCost;

    processedItems.push({
      itemId: cartItem.itemId || null,
      name: itemInDb ? itemInDb.name : (cartItem.name || 'Item'),
      urduName: itemInDb ? itemInDb.urduName : '',
      category: itemInDb ? itemInDb.category : (cartItem.category || 'General'),
      quantity: qty,
      unitPrice: price,
      unitCost: costPerUnit,
      itemDiscount: itemDiscount,
      totalPrice: lineTotal,
      totalCost: lineCost
    });
  }

  const totalAmount = Math.max(0, subtotal - discountVal);
  const profit = Math.max(0, totalAmount - totalCost);
  const isKhata = paymentMethod === 'Udhaar' || paymentMethod === 'Khata';
  const paid = amountPaid !== undefined ? Number(amountPaid) : (isKhata ? 0 : totalAmount);
  const due = Math.max(0, totalAmount - paid);

  const invoiceNo = generateInvoiceNo(database.sales);

  // Update Drawer / Cash balances (only for actual cash/till collected)
  if (paid > 0) {
    if (paymentMethod === 'Cash' || (!paymentMethod && paid > 0)) {
      database.drawer_balances.cashInHand += paid;
    } else if (paymentMethod === 'JazzCash') {
      database.drawer_balances.jazzCashTill += paid;
    } else if (paymentMethod === 'EasyPaisa') {
      database.drawer_balances.easyPaisaTill += paid;
    } else if (paymentMethod === 'Bank') {
      if (database.drawer_balances.bankTill !== undefined) {
        database.drawer_balances.bankTill += paid;
      }
    }
  }

  // If there's an unpaid amount or Udhaar/Khata, record in Khata with full transaction detail
  let matchedKhataEntry = null;
  if (due > 0 || isKhata) {
    if (!database.khata) database.khata = [];
    const custPhone = customerPhone ? customerPhone.trim() : '';
    const custName = customerName ? customerName.trim() : 'Customer';

    // 1. Find by khataCustomerId if specified
    if (khataCustomerId) {
      matchedKhataEntry = database.khata.find(k => k.id === khataCustomerId);
    }
    // 2. Find by phone
    if (!matchedKhataEntry && custPhone && custPhone !== 'Walk-in Customer') {
      matchedKhataEntry = database.khata.find(k => k.phone === custPhone);
    }
    // 3. Find by customerName
    if (!matchedKhataEntry && custName && custName !== 'Walk-in Customer' && custName !== 'Customer') {
      matchedKhataEntry = database.khata.find(k => k.customerName.toLowerCase() === custName.toLowerCase());
    }

    // 4. Create new entry if not existing
    if (!matchedKhataEntry) {
      matchedKhataEntry = {
        id: 'kh_' + Date.now(),
        customerName: custName,
        phone: custPhone,
        address: '',
        balanceDue: 0,
        history: []
      };
      database.khata.push(matchedKhataEntry);
    }

    // Add due amount to customer's Khata balanceDue
    matchedKhataEntry.balanceDue = (matchedKhataEntry.balanceDue || 0) + due;
    if (!matchedKhataEntry.history) matchedKhataEntry.history = [];

    matchedKhataEntry.history.unshift({
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      invoiceNo,
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      type: 'Credit',
      items: processedItems.map(p => ({
        itemId: p.itemId,
        name: p.name,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalPrice: p.totalPrice
      })),
      totalAmount: totalAmount,
      amountReceived: paid,
      amountDue: due,
      pendingPayment: due,
      status: due > 0 ? 'Pending' : 'Cleared',
      salesmanName: req.user.fullName,
      description: `POS Credit Sale Invoice #${invoiceNo}`
    });
  }

  const finalCustName = matchedKhataEntry ? matchedKhataEntry.customerName : (customerName ? customerName.trim() : 'Walk-in Customer');
  const finalCustPhone = matchedKhataEntry ? matchedKhataEntry.phone : (customerPhone ? customerPhone.trim() : '');

  const saleRecord = {
    id: 'sale_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    invoiceNo,
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    salesmanId: req.user.id,
    salesmanName: req.user.fullName,
    customerId: matchedKhataEntry ? matchedKhataEntry.id : null,
    customerName: finalCustName,
    customerPhone: finalCustPhone,
    items: processedItems,
    subtotal,
    discount: discountVal,
    totalAmount,
    totalCost,
    profit,
    paymentMethod: paymentMethod || 'Cash',
    amountPaid: paid,
    dueAmount: due,
    notes: notes ? notes.trim() : ''
  };

  database.sales.unshift(saleRecord);
  db.save();

  // Return receipt format
  const sanitizedSale = { ...saleRecord };
  if (req.user.role === 'salesman') {
    delete sanitizedSale.totalCost;
    delete sanitizedSale.profit;
    sanitizedSale.items = sanitizedSale.items.map(it => {
      const c = { ...it };
      delete c.unitCost;
      delete c.totalCost;
      return c;
    });
  }

  return res.status(201).json({
    message: 'Sale completed successfully',
    sale: sanitizedSale,
    customer: matchedKhataEntry ? {
      id: matchedKhataEntry.id,
      customerName: matchedKhataEntry.customerName,
      phone: matchedKhataEntry.phone,
      balanceDue: matchedKhataEntry.balanceDue
    } : null,
    shop: database.shop_settings
  });
});

// GET /api/pos/sales (List sales with filters)
router.get('/sales', requireAuth, (req, res) => {
  const { date, startDate, endDate, salesman, limit } = req.query;
  const database = db.get();
  let sales = [...database.sales];

  if (date) {
    sales = sales.filter(s => s.date === date);
  } else if (startDate && endDate) {
    sales = sales.filter(s => s.date >= startDate && s.date <= endDate);
  }

  if (salesman) {
    sales = sales.filter(s => s.salesmanName && s.salesmanName.includes(salesman));
  }

  // Limit results if needed
  if (limit) {
    sales = sales.slice(0, Number(limit));
  }

  const isSalesman = req.user.role === 'salesman';
  const sanitizedSales = sales.map(sale => {
    const s = { ...sale };
    if (isSalesman) {
      delete s.totalCost;
      delete s.profit;
      s.items = s.items.map(it => {
        const c = { ...it };
        delete c.unitCost;
        delete c.totalCost;
        return c;
      });
    }
    return s;
  });

  return res.json({ sales: sanitizedSales });
});

// GET /api/pos/sales/:id (Receipt view)
router.get('/sales/:id', requireAuth, (req, res) => {
  const database = db.get();
  const sale = database.sales.find(s => s.id === req.params.id || s.invoiceNo === req.params.id);
  if (!sale) {
    return res.status(404).json({ error: 'Sale record not found' });
  }

  const copy = { ...sale };
  if (req.user.role === 'salesman') {
    delete copy.totalCost;
    delete copy.profit;
    copy.items = copy.items.map(it => {
      const c = { ...it };
      delete c.unitCost;
      delete c.totalCost;
      return c;
    });
  }

  return res.json({ sale: copy, shop: database.shop_settings });
});

// DELETE /api/pos/sales/:id (Refund / cancel sale - Admin or Staff with Edit/Delete permission)
router.delete('/sales/:id', requireAuth, requirePermission('pos.editDelete'), (req, res) => {
  const database = db.get();
  const index = database.sales.findIndex(s => s.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Sale record not found' });
  }

  const sale = database.sales[index];

  // Restock items
  for (const item of sale.items) {
    if (item.itemId) {
      const dbItem = database.items.find(i => i.id === item.itemId);
      if (dbItem && dbItem.category !== 'Services') {
        dbItem.stockQuantity += item.quantity;
      }
    }
  }

  // Adjust cash drawer
  if (sale.paymentMethod === 'Cash') {
    database.drawer_balances.cashInHand -= sale.amountPaid;
  }

  database.sales.splice(index, 1);
  db.save();

  return res.json({ message: `Invoice ${sale.invoiceNo} cancelled and items returned to stock.` });
});

module.exports = router;
