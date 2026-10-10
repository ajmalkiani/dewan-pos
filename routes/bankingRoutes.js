const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, requirePermission, requireAnyPermission, hasPermission } = require('../auth');

// GET /api/banking/transactions (List transactions with filters)
router.get('/transactions', requireAuth, requireAnyPermission(['banking.entry', 'banking.balances']), (req, res) => {
  const { date, service, type, salesman } = req.query;
  const database = db.get();
  let list = [...database.banking_load];

  if (date) {
    list = list.filter(t => t.date === date);
  }

  if (service && service !== 'All') {
    list = list.filter(t => t.service === service);
  }

  if (type && type !== 'All') {
    list = list.filter(t => t.type === type);
  }

  if (salesman) {
    list = list.filter(t => t.salesmanName && t.salesmanName.includes(salesman));
  }

  const isSalesman = req.user.role === 'salesman';
  const sanitized = list.map(item => {
    const copy = { ...item };
    if (isSalesman) {
      delete copy.netProfit;
      delete copy.commissionEarned;
    }
    return copy;
  });

  return res.json({ transactions: sanitized });
});

// GET /api/banking/banks (Get list of Pakistani banks & custom banks)
router.get('/banks', requireAuth, (req, res) => {
  const database = db.get();
  if (!database.banks) {
    database.banks = [];
  }
  return res.json({ banks: database.banks });
});

// POST /api/banking/banks (Add a new Pakistani or custom bank)
router.post('/banks', requireAuth, (req, res) => {
  const { name, shortName, code, type, defaultAccount, defaultTitle } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Bank name is required' });
  }

  const database = db.get();
  if (!database.banks) {
    database.banks = [];
  }

  const trimmedName = name.trim();
  const exists = database.banks.find(b => b.name.toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: `Bank '${trimmedName}' is already in your bank list` });
  }

  const newBank = {
    id: 'bnk_custom_' + Date.now(),
    name: trimmedName,
    shortName: shortName && shortName.trim() ? shortName.trim() : trimmedName,
    code: code && code.trim() ? code.trim().toUpperCase() : '',
    type: type && type.trim() ? type.trim() : 'Custom Bank',
    defaultAccount: defaultAccount && defaultAccount.trim() ? defaultAccount.trim() : '',
    defaultTitle: defaultTitle && defaultTitle.trim() ? defaultTitle.trim() : '',
    isDefault: false,
    createdAt: new Date().toISOString()
  };

  database.banks.push(newBank);
  db.save();

  return res.status(201).json({
    message: `Bank '${newBank.name}' added successfully`,
    bank: newBank
  });
});

// DELETE /api/banking/banks/:id (Delete a custom added bank)
router.delete('/banks/:id', requireAuth, (req, res) => {
  const database = db.get();
  if (!database.banks) {
    return res.status(404).json({ error: 'Bank not found' });
  }

  const idx = database.banks.findIndex(b => b.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Bank not found' });
  }

  const bank = database.banks[idx];
  if (bank.isDefault) {
    return res.status(400).json({ error: 'Cannot delete built-in scheduled Pakistani banks' });
  }

  database.banks.splice(idx, 1);
  db.save();

  return res.json({ message: `Bank '${bank.name}' removed successfully` });
});

// POST /api/banking/transactions (Record JazzCash / EasyPaisa / Bank Transfer / Easyload / Bill)
router.post('/transactions', requireAuth, requirePermission('banking.entry'), (req, res) => {
  const {
    service, // 'JazzCash', 'EasyPaisa', 'Bank Transfer', 'Easyload', 'Bill'
    type,    // 'CashIn' (Send), 'CashOut' (Receive), 'Load', 'Bill'
    network, // 'Jazz', 'Zong', 'Telenor', 'Ufone', 'Onic', 'WAPDA/SNGPL'
    bankId,
    bankName,
    accountNumber,
    accountTitle,
    customerPhone,
    customerName,
    amount,
    feeCharged,       // Extra fee taken from customer e.g. Rs 50
    commissionEarned, // Telecom commission / margin e.g. Rs 25
    notes
  } = req.body;

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Please enter a valid amount' });
  }

  const database = db.get();
  const fee = Number(feeCharged) || 0;
  let comm = Number(commissionEarned) || 0;

  // Auto calculate load commission if zero (Standard Pakistan ~ 2.5% to 3%)
  if (service === 'Easyload' && !commissionEarned) {
    comm = Math.round(amt * 0.028); // 2.8%
  }

  const netProfit = fee + comm;

  if (!database.drawer_balances) {
    database.drawer_balances = {
      cashInHand: 0,
      jazzCashTill: 0,
      easyPaisaTill: 0,
      bankTill: 0,
      jazzLoadSim: 0,
      zongLoadSim: 0,
      telenorLoadSim: 0,
      ufoneLoadSim: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  // Update Drawer / Digital Balances
  // If CashIn (Sending money): Customer gives cash -> Cash In Hand increases, Digital/Bank balance decreases
  if (type === 'CashIn') {
    if (service === 'JazzCash') {
      database.drawer_balances.cashInHand += (amt + fee);
      database.drawer_balances.jazzCashTill -= amt;
    } else if (service === 'EasyPaisa') {
      database.drawer_balances.cashInHand += (amt + fee);
      database.drawer_balances.easyPaisaTill -= amt;
    } else if (service === 'Bank Transfer' || service === 'Bank') {
      database.drawer_balances.cashInHand += (amt + fee);
      if (database.drawer_balances.bankTill !== undefined) {
        database.drawer_balances.bankTill -= amt;
      }
    }
  }
  // If CashOut (Withdrawal): Customer takes cash -> Cash in Hand decreases, Digital/Bank balance increases
  else if (type === 'CashOut') {
    if (service === 'JazzCash') {
      database.drawer_balances.cashInHand -= (amt - fee);
      database.drawer_balances.jazzCashTill += amt;
    } else if (service === 'EasyPaisa') {
      database.drawer_balances.cashInHand -= (amt - fee);
      database.drawer_balances.easyPaisaTill += amt;
    } else if (service === 'Bank Transfer' || service === 'Bank') {
      database.drawer_balances.cashInHand -= (amt - fee);
      if (database.drawer_balances.bankTill !== undefined) {
        database.drawer_balances.bankTill += amt;
      }
    }
  }
  // If Easyload: Customer pays cash -> Cash In Hand increases, SIM load balance decreases
  else if (type === 'Load') {
    database.drawer_balances.cashInHand += amt;
    if (network === 'Jazz') database.drawer_balances.jazzLoadSim -= (amt - comm);
    else if (network === 'Zong') database.drawer_balances.zongLoadSim -= (amt - comm);
    else if (network === 'Telenor') database.drawer_balances.telenorLoadSim -= (amt - comm);
    else if (network === 'Ufone') database.drawer_balances.ufoneLoadSim -= (amt - comm);
  }
  // If Bill Payment: Customer pays bill + fee in cash -> Cash In Hand increases, Till decreases
  else if (type === 'Bill') {
    database.drawer_balances.cashInHand += (amt + fee);
    if (service === 'JazzCash') database.drawer_balances.jazzCashTill -= amt;
    else if (service === 'EasyPaisa') database.drawer_balances.easyPaisaTill -= amt;
  }

  const tx = {
    id: 'bnk_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    service: service || 'JazzCash',
    type: type || 'CashIn',
    network: network || '',
    bankId: bankId || '',
    bankName: bankName || '',
    accountNumber: accountNumber ? accountNumber.trim() : '',
    accountTitle: accountTitle ? accountTitle.trim() : '',
    customerPhone: customerPhone ? customerPhone.trim() : '',
    customerName: customerName ? customerName.trim() : (accountTitle ? accountTitle.trim() : 'Walk-in Customer'),
    amount: amt,
    feeCharged: fee,
    commissionEarned: comm,
    netProfit,
    salesmanName: req.user.fullName,
    notes: notes ? notes.trim() : ''
  };

  database.banking_load.unshift(tx);
  db.save();

  const sanitized = { ...tx };
  if (req.user.role === 'salesman') {
    delete sanitized.netProfit;
    delete sanitized.commissionEarned;
  }

  return res.status(201).json({
    message: 'Transaction recorded successfully',
    transaction: sanitized,
    balances: hasPermission(req.user, 'banking.balances') ? database.drawer_balances : null
  });
});

// GET /api/banking/balances (Get current drawer & account balances)
router.get('/balances', requireAuth, requirePermission('banking.balances'), (req, res) => {
  const database = db.get();
  return res.json({ balances: database.drawer_balances });
});

// PUT /api/banking/balances (Admin only: update/reconcile balances)
router.put('/balances', requireAuth, requireAdmin, (req, res) => {
  const database = db.get();
  const {
    cashInHand,
    jazzCashTill,
    easyPaisaTill,
    bankTill,
    jazzLoadSim,
    zongLoadSim,
    telenorLoadSim,
    ufoneLoadSim
  } = req.body;

  if (cashInHand !== undefined) database.drawer_balances.cashInHand = Number(cashInHand);
  if (jazzCashTill !== undefined) database.drawer_balances.jazzCashTill = Number(jazzCashTill);
  if (easyPaisaTill !== undefined) database.drawer_balances.easyPaisaTill = Number(easyPaisaTill);
  if (bankTill !== undefined) database.drawer_balances.bankTill = Number(bankTill);
  if (jazzLoadSim !== undefined) database.drawer_balances.jazzLoadSim = Number(jazzLoadSim);
  if (zongLoadSim !== undefined) database.drawer_balances.zongLoadSim = Number(zongLoadSim);
  if (telenorLoadSim !== undefined) database.drawer_balances.telenorLoadSim = Number(telenorLoadSim);
  if (ufoneLoadSim !== undefined) database.drawer_balances.ufoneLoadSim = Number(ufoneLoadSim);

  database.drawer_balances.lastUpdated = new Date().toISOString();
  db.save();

  return res.json({
    message: 'Till and SIM balances updated successfully',
    balances: database.drawer_balances
  });
});

module.exports = router;
