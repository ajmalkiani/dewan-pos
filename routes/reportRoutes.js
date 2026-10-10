const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, requirePermission, hasPermission } = require('../auth');

// Helper to calculate date ranges
function getDateRange(rangeType, customStart, customEnd) {
  const now = new Date();
  const format = (d) => d.toISOString().split('T')[0];

  let startDate = '';
  let endDate = format(now);

  if (rangeType === 'today') {
    startDate = format(now);
  } else if (rangeType === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    startDate = format(yest);
    endDate = format(yest);
  } else if (rangeType === '7days' || rangeType === 'week') {
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    startDate = format(past7);
  } else if (rangeType === '15days') {
    const past15 = new Date(now);
    past15.setDate(past15.getDate() - 14);
    startDate = format(past15);
  } else if (rangeType === 'month' || rangeType === '30days') {
    const pastMonth = new Date(now);
    pastMonth.setDate(pastMonth.getDate() - 29);
    startDate = format(pastMonth);
  } else if (rangeType === 'custom' && customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  } else {
    startDate = format(now);
  }

  return { startDate, endDate };
}

// GET /api/reports/financial (Full Financial & Profit Analysis - Reports View Permission)
router.get('/financial', requireAuth, requirePermission('reports.view'), (req, res) => {
  const { range = 'today', startDate: qStart, endDate: qEnd } = req.query;
  const { startDate, endDate } = getDateRange(range, qStart, qEnd);
  const database = db.get();

  // 1. Sales in period
  const sales = database.sales.filter(s => s.date >= startDate && s.date <= endDate);

  let posTotalRevenue = 0;
  let posTotalCost = 0;
  let posGrossProfit = 0;
  const categoryBreakdown = {};
  const salesmanPerformance = {};
  const paymentMethodsBreakdown = { Cash: 0, JazzCash: 0, EasyPaisa: 0, Bank: 0, Udhaar: 0 };

  for (const s of sales) {
    posTotalRevenue += (s.totalAmount || 0);
    posTotalCost += (s.totalCost || 0);
    posGrossProfit += (s.profit || 0);

    // Salesman stats
    const smName = s.salesmanName || 'Other Staff';
    if (!salesmanPerformance[smName]) {
      salesmanPerformance[smName] = { salesCount: 0, totalAmount: 0 };
    }
    salesmanPerformance[smName].salesCount += 1;
    salesmanPerformance[smName].totalAmount += (s.totalAmount || 0);

    // Payment method
    const pm = s.paymentMethod || 'Cash';
    if (paymentMethodsBreakdown[pm] !== undefined) {
      paymentMethodsBreakdown[pm] += (s.totalAmount || 0);
    } else {
      paymentMethodsBreakdown[pm] = (s.totalAmount || 0);
    }

    // Category breakdown
    for (const item of s.items) {
      const cat = item.category || 'Accessories';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { quantity: 0, salesAmount: 0, profitAmount: 0 };
      }
      categoryBreakdown[cat].quantity += (item.quantity || 1);
      categoryBreakdown[cat].salesAmount += (item.totalPrice || 0);
      const itemProfit = (item.totalPrice || 0) - (item.totalCost || 0);
      categoryBreakdown[cat].profitAmount += itemProfit;
    }
  }

  // 2. Mobile Repairs delivered in period
  const deliveredRepairs = database.repairs.filter(r => 
    r.status === 'Delivered' && r.deliveryDate >= startDate && r.deliveryDate <= endDate
  );

  let repairsRevenue = 0;
  let repairsPartsCost = 0;
  let repairsProfit = 0;

  for (const rep of deliveredRepairs) {
    repairsRevenue += (rep.finalCost || 0);
    const partsCost = (rep.partsUsed || []).reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
    const ownCost = rep.personalCost || 0;
    repairsPartsCost += partsCost + ownCost;
    repairsProfit += (typeof rep.profit === 'number' ? rep.profit : Math.max(0, rep.finalCost - (partsCost + ownCost)));
  }

  // 3. Easyload & JazzCash / EasyPaisa Transactions
  const bankingTx = database.banking_load.filter(b => b.date >= startDate && b.date <= endDate);
  let easyloadRevenue = 0;
  let easyloadProfit = 0;
  let moneyTransferVolume = 0;
  let moneyTransferProfit = 0;

  for (const b of bankingTx) {
    if (b.service === 'Easyload') {
      easyloadRevenue += (b.amount || 0);
      easyloadProfit += (b.netProfit || b.commissionEarned || 0);
    } else {
      moneyTransferVolume += (b.amount || 0);
      moneyTransferProfit += (b.netProfit || 0);
    }
  }

  // 4. Shop Expenses in period
  const expenses = database.expenses.filter(e => e.date >= startDate && e.date <= endDate);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Overall Financial Totals
  const totalShopRevenue = posTotalRevenue + repairsRevenue + easyloadRevenue;
  const totalShopGrossProfit = posGrossProfit + repairsProfit + easyloadProfit + moneyTransferProfit;
  const totalShopNetProfit = totalShopGrossProfit - totalExpenses;

  return res.json({
    period: {
      range,
      startDate,
      endDate
    },
    summary: {
      totalSalesRevenue: totalShopRevenue,
      posSalesRevenue: posTotalRevenue,
      repairsRevenue: repairsRevenue,
      easyloadVolume: easyloadRevenue,
      moneyTransferVolume: moneyTransferVolume,
      
      costOfGoodsSold: posTotalCost + repairsPartsCost,
      grossProfit: totalShopGrossProfit,
      totalExpenses: totalExpenses,
      netProfit: totalShopNetProfit
    },
    departments: {
      posProfit: posGrossProfit,
      repairsProfit: repairsProfit,
      easyloadProfit: easyloadProfit,
      moneyTransferProfit: moneyTransferProfit
    },
    categoryBreakdown,
    salesmanPerformance,
    paymentMethodsBreakdown,
    counts: {
      posInvoicesCount: sales.length,
      repairsDeliveredCount: deliveredRepairs.length,
      bankingTransactionsCount: bankingTx.length,
      expensesCount: expenses.length
    }
  });
});

// GET /api/reports/inventory-valuation (Full Stock Investment & Valuation - Reports View Permission)
router.get('/inventory-valuation', requireAuth, requirePermission('reports.view'), (req, res) => {
  const database = db.get();
  
  let totalStockUnits = 0;
  let totalCostValuation = 0;
  let totalRetailValuation = 0;
  const lowStockItems = [];
  const categoryStats = {};

  for (const item of database.items) {
    if (item.category === 'Services') continue; // Skip intangible services

    const qty = item.stockQuantity || 0;
    const cost = item.costPrice || 0;
    const price = item.salePrice || 0;

    totalStockUnits += qty;
    totalCostValuation += (qty * cost);
    totalRetailValuation += (qty * price);

    if (qty <= (item.minAlertQuantity || 3)) {
      lowStockItems.push({
        id: item.id,
        name: item.name,
        urduName: item.urduName,
        category: item.category,
        subCategory: item.subCategory,
        stockQuantity: qty,
        minAlertQuantity: item.minAlertQuantity,
        costPrice: item.costPrice,
        salePrice: item.salePrice
      });
    }

    const cat = item.category || 'Accessories';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { totalUnits: 0, costValue: 0, retailValue: 0 };
    }
    categoryStats[cat].totalUnits += qty;
    categoryStats[cat].costValue += (qty * cost);
    categoryStats[cat].retailValue += (qty * price);
  }

  const potentialGrossProfit = totalRetailValuation - totalCostValuation;

  return res.json({
    totalStockUnits,
    totalCostValuation,
    totalRetailValuation,
    potentialGrossProfit,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    categoryStats
  });
});

// GET /api/reports/dashboard-stats (Overview for main page)
router.get('/dashboard-stats', requireAuth, (req, res) => {
  const database = db.get();
  const today = new Date().toISOString().split('T')[0];

  const todaySales = database.sales.filter(s => s.date === today);
  const todaySalesTotal = todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const activeRepairs = database.repairs.filter(r => r.status === 'Received' || r.status === 'InProgress');
  const readyRepairs = database.repairs.filter(r => r.status === 'Repaired');

  const lowStockCount = database.items.filter(i => i.category !== 'Services' && i.stockQuantity <= i.minAlertQuantity).length;

  const response = {
    todaySalesCount: todaySales.length,
    todaySalesTotal: todaySalesTotal,
    activeRepairsCount: activeRepairs.length,
    readyRepairsCount: readyRepairs.length,
    lowStockCount: lowStockCount,
    drawerCash: database.drawer_balances.cashInHand
  };

  // If Admin or user with Reports View permission, include profit figures
  if (req.user.role === 'admin' || hasPermission(req.user, 'reports.view')) {
    const todayPosProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const todayExpenses = database.expenses
      .filter(e => e.date === today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const todayBankingProfit = database.banking_load
      .filter(b => b.date === today)
      .reduce((sum, b) => sum + (b.netProfit || 0), 0);

    const todayRepairsProfit = database.repairs
      .filter(r => r.status === 'Delivered' && r.deliveryDate === today)
      .reduce((sum, r) => sum + (r.profit || 0), 0);

    response.todayProfit = (todayPosProfit + todayBankingProfit + todayRepairsProfit) - todayExpenses;
    response.todayExpenses = todayExpenses;
  }

  return res.json(response);
});

module.exports = router;
