const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, requirePermission, hasPermission } = require('../auth');

// Helper to normalize khata history entries and guarantee all 10 items
function enrichCustomerKhata(k) {
  const history = (k.history || []).map(h => {
    if (h.type === 'Credit') {
      const items = (Array.isArray(h.items) && h.items.length > 0)
        ? h.items
        : [{
            name: h.description || 'Credit Sale Items',
            quantity: 1,
            unitPrice: Number(h.totalAmount || h.amount || 0),
            totalPrice: Number(h.totalAmount || h.amount || 0)
          }];
      const totalAmount = h.totalAmount !== undefined ? Number(h.totalAmount) : Number(h.amount || 0);
      const amountReceived = h.amountReceived !== undefined ? Number(h.amountReceived) : 0;
      const amountDue = h.amountDue !== undefined ? Number(h.amountDue) : Math.max(0, totalAmount - amountReceived);
      const pendingPayment = h.pendingPayment !== undefined ? Number(h.pendingPayment) : amountDue;

      return {
        id: h.id || 'tx_' + Math.random().toString(36).substr(2, 9),
        invoiceNo: h.invoiceNo || 'INV-CREDIT',
        date: h.date || new Date().toISOString().split('T')[0],
        timestamp: h.timestamp || new Date().toISOString(),
        type: 'Credit',
        items: items, // Items Sold
        totalAmount, // Total Amount
        amountReceived, // Amount Received
        amountDue, // Amount Due
        pendingPayment, // Pending Payment
        status: h.status || (amountDue <= 0 ? 'Cleared' : 'Pending'),
        salesmanName: h.salesmanName || 'Staff',
        description: h.description || `Credit Sale #${h.invoiceNo || ''}`
      };
    } else {
      const amt = Number(h.amount || h.amountReceived || 0);
      return {
        id: h.id || 'pay_' + Math.random().toString(36).substr(2, 9),
        receiptNo: h.receiptNo || 'RCP-' + (h.date ? h.date.replace(/-/g, '') : Date.now()),
        date: h.date || new Date().toISOString().split('T')[0],
        timestamp: h.timestamp || new Date().toISOString(),
        type: 'Payment',
        amount: amt,
        amountReceived: amt, // Amount Received
        paymentMethod: h.paymentMethod || 'Cash',
        salesmanName: h.salesmanName || 'Staff',
        balanceBefore: h.balanceBefore !== undefined ? h.balanceBefore : 0,
        balanceAfter: h.balanceAfter !== undefined ? h.balanceAfter : 0,
        description: h.description || `Payment received via ${h.paymentMethod || 'Cash'}`
      };
    }
  });

  // Calculate Aggregates
  const creditSales = history.filter(h => h.type === 'Credit');
  const paymentHistory = history.filter(h => h.type === 'Payment');

  const totalCreditAmount = creditSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  const totalUpfrontPaid = creditSales.reduce((sum, s) => sum + (Number(s.amountReceived) || 0), 0);
  const totalInstallmentsPaid = paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalAmountReceived = totalUpfrontPaid + totalInstallmentsPaid;
  const balanceDue = Number(k.balanceDue) || 0;

  // Flatten all items sold across all credit sales
  const itemsSold = [];
  creditSales.forEach(sale => {
    (sale.items || []).forEach(it => {
      itemsSold.push({
        ...it,
        invoiceNo: sale.invoiceNo,
        date: sale.date,
        saleTotal: sale.totalAmount
      });
    });
  });

  // Compute Due Items (items pending payment)
  const dueItems = [];
  if (balanceDue > 0) {
    creditSales.forEach(sale => {
      if (sale.status !== 'Cleared') {
        (sale.items || []).forEach(it => {
          dueItems.push({
            itemName: it.name,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            totalPrice: it.totalPrice || (it.quantity * it.unitPrice) || 0,
            invoiceNo: sale.invoiceNo,
            date: sale.date,
            customerName: k.customerName,
            phone: k.phone,
            salePending: sale.pendingPayment || sale.amountDue || 0
          });
        });
      }
    });

    // If no individual credit sale items found but balanceDue exists, create fallback due item
    if (dueItems.length === 0 && balanceDue > 0) {
      dueItems.push({
        itemName: 'Credit Balance / Goods Taken',
        quantity: 1,
        unitPrice: balanceDue,
        totalPrice: balanceDue,
        invoiceNo: 'BAL-DUE',
        date: k.history?.[0]?.date || new Date().toISOString().split('T')[0],
        customerName: k.customerName,
        phone: k.phone,
        salePending: balanceDue
      });
    }
  }

  return {
    id: k.id,
    customerName: k.customerName,
    phone: k.phone,
    address: k.address || '',
    customerBalance: balanceDue, // Customer Balance
    balanceDue: balanceDue, // Amount Due
    totalAmount: totalCreditAmount, // Total Amount of credit sales
    amountReceived: totalAmountReceived, // Amount Received in total
    amountDue: balanceDue, // Amount Due
    pendingPayment: balanceDue, // Pending Payment
    itemsSold, // Items Sold
    dueItems, // Due Items
    dueItemsCount: dueItems.length,
    paymentHistory, // Payment History
    creditSales, // Credit Sales
    history // Full chronological history
  };
}

// GET /api/khata (List all customer credit khata records with full summary)
router.get('/', requireAuth, requirePermission('expensesKhata.viewKhata'), (req, res) => {
  const database = db.get();
  const rawKhata = database.khata || [];
  const enrichedList = rawKhata.map(enrichCustomerKhata);

  const totalCustomers = enrichedList.length;
  const totalCustomerBalance = enrichedList.reduce((sum, c) => sum + c.customerBalance, 0);
  const totalAmount = enrichedList.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalAmountReceived = enrichedList.reduce((sum, c) => sum + c.amountReceived, 0);
  const totalPendingPayment = totalCustomerBalance;
  
  const allDueItems = [];
  enrichedList.forEach(c => {
    allDueItems.push(...c.dueItems);
  });

  return res.json({
    khata: enrichedList,
    summary: {
      totalCustomers,
      totalCustomerBalance,
      totalAmount,
      totalAmountReceived,
      totalPendingPayment,
      totalDueItemsCount: allDueItems.length,
      dueItems: allDueItems
    }
  });
});

// GET /api/khata/due-items/all (All due items across all customers)
router.get('/due-items/all', requireAuth, requirePermission('expensesKhata.viewKhata'), (req, res) => {
  const database = db.get();
  const rawKhata = database.khata || [];
  const enrichedList = rawKhata.map(enrichCustomerKhata);
  
  const allDueItems = [];
  enrichedList.forEach(c => {
    allDueItems.push(...c.dueItems);
  });

  return res.json({
    dueItems: allDueItems,
    totalCount: allDueItems.length,
    totalDueAmount: enrichedList.reduce((sum, c) => sum + c.customerBalance, 0)
  });
});

// GET /api/khata/:id (Single customer details, statement & payment history)
router.get('/:id', requireAuth, requirePermission('expensesKhata.viewKhata'), (req, res) => {
  const database = db.get();
  const customer = (database.khata || []).find(k => k.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer ledger not found' });
  }

  const enriched = enrichCustomerKhata(customer);
  return res.json({
    customer: enriched,
    shop: database.shop_settings
  });
});

// GET /api/khata/:id/statement (Sales Statement for customer)
router.get('/:id/statement', requireAuth, requirePermission('expensesKhata.viewKhata'), (req, res) => {
  const database = db.get();
  const customer = (database.khata || []).find(k => k.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer ledger not found' });
  }

  const enriched = enrichCustomerKhata(customer);

  // Compute running balance for statement entries
  let runningBalance = 0;
  // Sort chronological ascending for statement
  const sortedHistory = [...enriched.history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const statementRows = sortedHistory.map(entry => {
    if (entry.type === 'Credit') {
      runningBalance += Number(entry.amountDue || entry.totalAmount || 0);
    } else {
      runningBalance = Math.max(0, runningBalance - Number(entry.amount || 0));
    }

    return {
      date: entry.date,
      type: entry.type,
      refNo: entry.invoiceNo || entry.receiptNo || '-',
      itemsSold: entry.items || [],
      itemsSummary: (entry.items || []).map(i => `${i.name} (x${i.quantity || 1})`).join(', ') || entry.description,
      totalAmount: entry.totalAmount || entry.amount || 0,
      amountReceived: entry.amountReceived || (entry.type === 'Payment' ? entry.amount : 0) || 0,
      amountDue: entry.amountDue !== undefined ? entry.amountDue : (entry.type === 'Credit' ? entry.totalAmount : 0),
      runningBalance,
      notes: entry.description
    };
  });

  return res.json({
    statement: statementRows,
    customer: {
      id: enriched.id,
      customerName: enriched.customerName,
      phone: enriched.phone,
      address: enriched.address,
      customerBalance: enriched.customerBalance,
      totalAmount: enriched.totalAmount,
      amountReceived: enriched.amountReceived,
      amountDue: enriched.amountDue,
      pendingPayment: enriched.pendingPayment
    },
    dueItems: enriched.dueItems,
    shop: database.shop_settings,
    statementDate: new Date().toISOString().split('T')[0]
  });
});

// POST /api/khata/credit-sale (Record a new Credit Sale directly in Khata)
router.post('/credit-sale', requireAuth, requirePermission('expensesKhata.add'), (req, res) => {
  const {
    customerId,
    customerName,
    phone,
    address,
    items,
    totalAmount,
    amountReceived,
    amountDue,
    paymentMethod,
    notes
  } = req.body;

  if (!customerName || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item must be sold on credit' });
  }

  const database = db.get();
  if (!database.khata) database.khata = [];
  if (!database.sales) database.sales = [];

  // Find or create customer
  let customer = null;
  if (customerId) {
    customer = database.khata.find(k => k.id === customerId);
  }
  if (!customer) {
    customer = database.khata.find(k => k.phone === phone.trim());
  }
  if (!customer) {
    customer = {
      id: 'kh_' + Date.now(),
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : '',
      balanceDue: 0,
      history: []
    };
    database.khata.push(customer);
  } else {
    customer.customerName = customerName.trim();
    if (address) customer.address = address.trim();
  }

  // Calculate Amounts
  const totAmount = Number(totalAmount) || items.reduce((sum, i) => sum + (Number(i.totalPrice) || (Number(i.quantity) * Number(i.unitPrice)) || 0), 0);
  const amtReceived = Number(amountReceived) || 0;
  const amtDue = Math.max(0, totAmount - amtReceived);

  // Generate Invoice No
  const invoiceNo = `DM-CS-${1000 + database.sales.length + 1}`;

  // Process items and deduct stock if in inventory
  let totalCost = 0;
  const processedItems = items.map(it => {
    const qty = Number(it.quantity) || 1;
    const price = Number(it.unitPrice) || 0;
    const lineTotal = Number(it.totalPrice) || (qty * price);

    // Stock deduction if itemId matches
    if (it.itemId) {
      const stockItem = (database.items || []).find(si => si.id === it.itemId);
      if (stockItem) {
        stockItem.stockQuantity = Math.max(0, (stockItem.stockQuantity || 0) - qty);
        totalCost += (Number(stockItem.costPrice) || 0) * qty;
      }
    }

    return {
      itemId: it.itemId || '',
      name: it.name.trim(),
      quantity: qty,
      unitPrice: price,
      totalPrice: lineTotal
    };
  });

  // Record Sale in database.sales so it reports in sales & profit
  const newSale = {
    id: 'sale_' + Date.now(),
    invoiceNo,
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    salesmanId: req.user.id,
    salesmanName: req.user.fullName,
    customerName: customer.customerName,
    customerPhone: customer.phone,
    items: processedItems,
    subtotal: totAmount,
    discount: 0,
    totalAmount: totAmount,
    totalCost,
    profit: Math.max(0, totAmount - totalCost),
    paymentMethod: paymentMethod || 'Udhaar',
    amountPaid: amtReceived,
    dueAmount: amtDue,
    notes: notes ? notes.trim() : 'Credit Sale from Khata Module'
  };
  database.sales.unshift(newSale);

  // Deposit upfront received cash into drawer till
  if (amtReceived > 0) {
    const method = paymentMethod || 'Cash';
    if (method === 'Cash') {
      database.drawer_balances.cashInHand += amtReceived;
    } else if (method === 'JazzCash') {
      database.drawer_balances.jazzCashTill += amtReceived;
    } else if (method === 'EasyPaisa') {
      database.drawer_balances.easyPaisaTill += amtReceived;
    } else if (method === 'Bank' && database.drawer_balances.bankTill !== undefined) {
      database.drawer_balances.bankTill += amtReceived;
    }
  }

  // Update customer ledger
  customer.balanceDue = (customer.balanceDue || 0) + amtDue;
  if (!customer.history) customer.history = [];

  customer.history.unshift({
    id: 'tx_' + Date.now(),
    invoiceNo,
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    type: 'Credit',
    items: processedItems, // Items Sold
    totalAmount: totAmount, // Total Amount
    amountReceived: amtReceived, // Amount Received
    amountDue: amtDue, // Amount Due
    pendingPayment: amtDue, // Pending Payment
    status: amtDue > 0 ? 'Pending' : 'Cleared',
    salesmanName: req.user.fullName,
    description: notes ? notes.trim() : `Credit Sale #${invoiceNo} (${processedItems.map(i => i.name).join(', ')})`
  });

  db.save();

  return res.status(201).json({
    message: `Credit sale recorded successfully. Invoice #${invoiceNo}. Amount Due: Rs. ${amtDue}`,
    sale: newSale,
    customer: enrichCustomerKhata(customer),
    shop: database.shop_settings
  });
});

// POST /api/khata/:id/payment (Receive payment from customer & add to Payment History)
router.post('/:id/payment', requireAuth, requirePermission('expensesKhata.add'), (req, res) => {
  const { amount, paymentMethod, notes, date } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Please enter a valid payment amount' });
  }

  const database = db.get();
  const customer = (database.khata || []).find(k => k.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer ledger not found' });
  }

  const balanceBefore = customer.balanceDue || 0;
  customer.balanceDue = Math.max(0, balanceBefore - amt);
  const balanceAfter = customer.balanceDue;

  // Deposit cash/funds into the chosen till drawer
  const method = paymentMethod || 'Cash';
  if (method === 'Cash') {
    database.drawer_balances.cashInHand += amt;
  } else if (method === 'JazzCash') {
    database.drawer_balances.jazzCashTill += amt;
  } else if (method === 'EasyPaisa') {
    database.drawer_balances.easyPaisaTill += amt;
  } else if (method === 'Bank' && database.drawer_balances.bankTill !== undefined) {
    database.drawer_balances.bankTill += amt;
  }

  // Generate Receipt No
  const receiptNo = `DM-REC-${Date.now().toString().slice(-5)}`;

  // Record payment in Customer History (Payment History)
  if (!customer.history) customer.history = [];
  customer.history.unshift({
    id: 'pay_' + Date.now(),
    receiptNo,
    date: date || new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    type: 'Payment',
    amount: amt,
    amountReceived: amt, // Amount Received
    paymentMethod: method,
    salesmanName: req.user.fullName,
    balanceBefore,
    balanceAfter,
    description: notes ? notes.trim() : `Payment received via ${method}`
  });

  // Automatically mark older pending credit transactions as Cleared if balance cleared
  if (customer.balanceDue === 0) {
    customer.history.forEach(h => {
      if (h.type === 'Credit') {
        h.status = 'Cleared';
        h.pendingPayment = 0;
      }
    });
  }

  db.save();

  return res.json({
    message: `Payment of Rs. ${amt.toLocaleString()} received via ${method}. Remaining Customer Balance: Rs. ${balanceAfter.toLocaleString()}`,
    receiptNo,
    customer: enrichCustomerKhata(customer),
    shop: database.shop_settings
  });
});

// POST /api/khata (Legacy / Quick Add Customer or Ledger Entry)
router.post('/', requireAuth, requirePermission('expensesKhata.add'), (req, res) => {
  const { customerName, phone, address, amount, type, description } = req.body;
  if (!customerName || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required' });
  }

  const database = db.get();
  if (!database.khata) database.khata = [];

  let entry = database.khata.find(k => k.phone === phone.trim());
  if (!entry) {
    entry = {
      id: 'kh_' + Date.now(),
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address ? address.trim() : '',
      balanceDue: 0,
      history: []
    };
    database.khata.push(entry);
  } else {
    entry.customerName = customerName.trim();
    if (address) entry.address = address.trim();
  }

  const amt = Number(amount) || 0;
  if (amt > 0) {
    const isCredit = type === 'Credit';
    if (isCredit) {
      entry.balanceDue += amt;
    } else {
      entry.balanceDue = Math.max(0, entry.balanceDue - amt);
      database.drawer_balances.cashInHand += amt;
    }

    if (!entry.history) entry.history = [];
    entry.history.unshift({
      id: 'tx_' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      type: isCredit ? 'Credit' : 'Payment',
      amount: amt,
      totalAmount: amt,
      amountReceived: isCredit ? 0 : amt,
      amountDue: isCredit ? amt : 0,
      pendingPayment: isCredit ? amt : 0,
      items: [{ name: description || 'Credit Entry', quantity: 1, unitPrice: amt, totalPrice: amt }],
      description: description ? description.trim() : (isCredit ? 'Credit balance added' : 'Payment received'),
      salesmanName: req.user.fullName
    });
  }

  db.save();
  return res.json({ message: 'Customer ledger updated', khata: enrichCustomerKhata(entry) });
});

// PUT /api/khata/:id (Edit customer details)
router.put('/:id', requireAuth, requirePermission('expensesKhata.editDelete'), (req, res) => {
  const { customerName, phone, address } = req.body;
  if (!customerName || !customerName.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const database = db.get();
  const entry = (database.khata || []).find(k => k.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Customer ledger not found' });
  }

  entry.customerName = customerName.trim();
  if (phone) entry.phone = phone.trim();
  if (address !== undefined) entry.address = address.trim();

  db.save();
  return res.json({
    message: 'Customer details updated successfully',
    khata: enrichCustomerKhata(entry)
  });
});

// DELETE /api/khata/:id (Delete customer ledger - Edit/Delete permission)
router.delete('/:id', requireAuth, requirePermission('expensesKhata.editDelete'), (req, res) => {
  const database = db.get();
  const index = (database.khata || []).findIndex(k => k.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Customer ledger not found' });
  }

  const deleted = database.khata.splice(index, 1)[0];
  db.save();

  return res.json({
    message: `Khata ledger for "${deleted.customerName}" deleted successfully`,
    deletedId: deleted.id
  });
});

module.exports = router;
