const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, requirePermission, requireAnyPermission, hasPermission } = require('../auth');

// GET /api/expenses
router.get('/', requireAuth, requireAnyPermission(['expensesKhata.add', 'expensesKhata.editDelete', 'expensesKhata.viewKhata']), (req, res) => {
  const { date, startDate, endDate } = req.query;
  const database = db.get();
  let expenses = [...database.expenses];

  if (date) {
    expenses = expenses.filter(e => e.date === date);
  } else if (startDate && endDate) {
    expenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
  }

  return res.json({ expenses });
});

// POST /api/expenses (Record shop expense - Add Entry permission)
router.post('/', requireAuth, requirePermission('expensesKhata.add'), (req, res) => {
  const { title, category, amount, notes } = req.body;
  const amt = Number(amount);
  if (!title || !amt || amt <= 0) {
    return res.status(400).json({ error: 'Please enter expense title and valid amount' });
  }

  const database = db.get();
  const newExp = {
    id: 'exp_' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    title: title.trim(),
    category: category || 'Tea/Food',
    amount: amt,
    paidBy: req.user.fullName,
    notes: notes ? notes.trim() : ''
  };

  // Deduct from cash in drawer
  database.drawer_balances.cashInHand -= amt;
  database.expenses.unshift(newExp);
  db.save();

  return res.status(201).json({
    message: 'Expense recorded successfully',
    expense: newExp
  });
});

// DELETE /api/expenses/:id (Edit/Delete permission)
router.delete('/:id', requireAuth, requirePermission('expensesKhata.editDelete'), (req, res) => {
  const database = db.get();
  const index = database.expenses.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  const deleted = database.expenses.splice(index, 1)[0];
  database.drawer_balances.cashInHand += deleted.amount;
  db.save();

  return res.json({ message: 'Expense deleted and amount returned to cash drawer.' });
});

module.exports = router;
