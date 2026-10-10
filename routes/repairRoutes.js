const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, requirePermission, requireAnyPermission, hasPermission } = require('../auth');

function generateTicketNo(repairsList) {
  const currentYear = new Date().getFullYear();
  const nextNum = 1000 + repairsList.length + 1;
  return `DM-REP-${nextNum}`;
}

// GET /api/repairs (List repair jobs with filters)
router.get('/', requireAuth, requireAnyPermission(['repairs.add', 'repairs.updateStatus', 'repairs.delete']), (req, res) => {
  const { status, search, technician } = req.query;
  const database = db.get();
  let repairs = [...database.repairs];

  if (status && status !== 'All') {
    repairs = repairs.filter(r => r.status === status);
  }

  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    repairs = repairs.filter(r =>
      (r.ticketNo && r.ticketNo.toLowerCase().includes(q)) ||
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.customerPhone && r.customerPhone.includes(q)) ||
      (r.deviceBrand && r.deviceBrand.toLowerCase().includes(q)) ||
      (r.deviceModel && r.deviceModel.toLowerCase().includes(q)) ||
      (r.imei && r.imei.includes(q)) ||
      (r.imei1 && r.imei1.includes(q)) ||
      (r.imei2 && r.imei2.includes(q))
    );
  }

  if (technician) {
    repairs = repairs.filter(r => r.technicianName && r.technicianName.includes(technician));
  }

  const isSalesman = req.user.role === 'salesman';
  const sanitizedRepairs = repairs.map(rep => {
    const r = { ...rep };
    if (isSalesman) {
      delete r.profit;
      delete r.laborCost;
      if (r.partsUsed) {
        r.partsUsed = r.partsUsed.map(p => {
          const cp = { ...p };
          delete cp.costPrice;
          return cp;
        });
      }
    }
    return r;
  });

  return res.json({ repairs: sanitizedRepairs });
});

// GET /api/repairs/:id (Single ticket details & token print)
router.get('/:id', requireAuth, requireAnyPermission(['repairs.add', 'repairs.updateStatus', 'repairs.delete']), (req, res) => {
  const database = db.get();
  const repair = database.repairs.find(r => r.id === req.params.id || r.ticketNo === req.params.id);
  if (!repair) {
    return res.status(404).json({ error: 'Repair ticket not found' });
  }

  const copy = { ...repair };
  if (req.user.role === 'salesman') {
    delete copy.profit;
    delete copy.laborCost;
    if (copy.partsUsed) {
      copy.partsUsed = copy.partsUsed.map(p => {
        const cp = { ...p };
        delete cp.costPrice;
        return cp;
      });
    }
  }

  return res.json({ repair: copy, shop: database.shop_settings });
});

// POST /api/repairs (Create new repair job token)
router.post('/', requireAuth, requirePermission('repairs.add'), (req, res) => {
  const {
    customerName,
    customerPhone,
    customerCnic,
    deviceBrand,
    deviceModel,
    deviceColor,
    imei,
    imei1,
    imei2,
    faultType, // 'Hardware', 'Software', 'Both'
    faultDescription,
    patternLock,
    accessoriesReceived,
    estimatedCost,
    personalCost,
    advancePaid,
    technicianName,
    notes
  } = req.body;

  if (!customerName || !deviceModel || !faultDescription) {
    return res.status(400).json({ error: 'Customer name, mobile model, and fault description are required' });
  }

  const database = db.get();
  const ticketNo = generateTicketNo(database.repairs);
  const estCost = Number(estimatedCost) || 0;
  const pCost = Number(personalCost) || 0;
  const advPaid = Number(advancePaid) || 0;

  const cleanImei1 = imei1 ? String(imei1).trim() : (imei ? String(imei).trim() : '');
  const cleanImei2 = imei2 ? String(imei2).trim() : '';
  const combinedImei = [cleanImei1, cleanImei2].filter(Boolean).join(' / ');

  const newRepair = {
    id: 'rep_' + Date.now(),
    ticketNo,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    customerName: customerName.trim(),
    customerPhone: customerPhone ? customerPhone.trim() : '',
    customerCnic: customerCnic ? customerCnic.trim() : '',
    deviceBrand: deviceBrand ? deviceBrand.trim() : '',
    deviceModel: deviceModel.trim(),
    deviceColor: deviceColor ? deviceColor.trim() : '',
    imei: combinedImei,
    imei1: cleanImei1,
    imei2: cleanImei2,
    faultType: faultType || 'Hardware',
    faultDescription: faultDescription.trim(),
    patternLock: patternLock ? patternLock.trim() : '',
    accessoriesReceived: accessoriesReceived ? accessoriesReceived.trim() : 'Only Device',
    estimatedCost: estCost,
    personalCost: pCost,
    finalCost: estCost,
    advancePaid: advPaid,
    remainingDue: Math.max(0, estCost - advPaid),
    partsUsed: [],
    laborCost: Math.max(0, estCost - pCost),
    profit: Math.max(0, estCost - pCost),
    technicianName: technicianName ? technicianName.trim() : req.user.fullName,
    salesmanName: req.user.fullName,
    status: 'Received', // Received, InProgress, Repaired, Delivered, Cancelled
    deliveryDate: '',
    notes: notes ? notes.trim() : ''
  };

  // If advance received in cash, update cash drawer
  if (advPaid > 0) {
    database.drawer_balances.cashInHand += advPaid;
  }

  database.repairs.unshift(newRepair);
  db.save();

  return res.status(201).json({
    message: `Repair ticket #${ticketNo} created successfully`,
    repair: newRepair,
    shop: database.shop_settings
  });
});

// POST /api/repairs/:id/parts (Attach spare part to repair job)
router.post('/:id/parts', requireAuth, requirePermission('repairs.updateStatus'), (req, res) => {
  const { partItemId, quantity, partSellingPrice } = req.body;
  if (!partItemId) {
    return res.status(400).json({ error: 'Please select a spare part' });
  }

  const database = db.get();
  const repair = database.repairs.find(r => r.id === req.params.id);
  if (!repair) {
    return res.status(404).json({ error: 'Repair job not found' });
  }

  const partItem = database.items.find(i => i.id === partItemId);
  if (!partItem) {
    return res.status(404).json({ error: 'Spare part not found in inventory' });
  }

  const qty = Number(quantity) || 1;
  if (partItem.stockQuantity < qty) {
    return res.status(400).json({ error: `Low stock! Only ${partItem.stockQuantity} pcs available.` });
  }

  // Deduct from inventory
  partItem.stockQuantity -= qty;
  partItem.updatedAt = new Date().toISOString();

  const sellPrice = partSellingPrice !== undefined ? Number(partSellingPrice) : partItem.salePrice;
  const costPrice = partItem.costPrice || 0;

  if (!repair.partsUsed) repair.partsUsed = [];
  repair.partsUsed.push({
    itemId: partItem.id,
    name: partItem.name,
    urduName: partItem.urduName,
    quantity: qty,
    costPrice: costPrice,
    salePrice: sellPrice
  });

  // Recalculate repair profit
  const totalPartsCost = repair.partsUsed.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
  const ownCost = repair.personalCost || 0;
  repair.profit = Math.max(0, repair.finalCost - (totalPartsCost + ownCost));

  db.save();
  return res.json({
    message: `${partItem.name} added to this ticket and deducted from stock`,
    repair
  });
});

// PATCH /api/repairs/:id/status (Update job status)
router.patch('/:id/status', requireAuth, requirePermission('repairs.updateStatus'), (req, res) => {
  const { status, finalCost, personalCost, remainingPaymentReceived, notes, technicianName, customerName, customerPhone, imei1, imei2 } = req.body;
  const database = db.get();
  const repair = database.repairs.find(r => r.id === req.params.id);
  if (!repair) {
    return res.status(404).json({ error: 'Repair job not found' });
  }

  if (imei1 !== undefined) {
    repair.imei1 = imei1 ? String(imei1).trim() : '';
  }
  if (imei2 !== undefined) {
    repair.imei2 = imei2 ? String(imei2).trim() : '';
  }
  if (imei1 !== undefined || imei2 !== undefined) {
    repair.imei = [repair.imei1, repair.imei2].filter(Boolean).join(' / ');
  }

  // Admin-only check for customer name and contact number
  if (customerName !== undefined || customerPhone !== undefined) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied: Only administrators can edit customer name and contact number.' });
    }
    if (customerName !== undefined) {
      if (!customerName.trim()) {
        return res.status(400).json({ error: 'Customer name is required.' });
      }
      repair.customerName = customerName.trim();
    }
    if (customerPhone !== undefined) {
      repair.customerPhone = customerPhone.trim();
    }
  }

  const previousStatus = repair.status;

  if (status) {
    repair.status = status;
  }

  if (technicianName !== undefined && technicianName.trim() !== '') {
    repair.technicianName = technicianName.trim();
  }

  if (finalCost !== undefined && !isNaN(Number(finalCost))) {
    repair.finalCost = Number(finalCost);
  }

  if (personalCost !== undefined && !isNaN(Number(personalCost))) {
    repair.personalCost = Number(personalCost);
  }

  if (notes !== undefined) {
    repair.notes = notes.trim();
  }

  // If status is Delivered
  if (status === 'Delivered') {
    if (!repair.deliveryDate) {
      repair.deliveryDate = new Date().toISOString().split('T')[0];
    }
    const remainingToPay = Math.max(0, repair.finalCost - repair.advancePaid);
    const paidNow = remainingPaymentReceived !== undefined ? Number(remainingPaymentReceived) : remainingToPay;
    repair.remainingDue = Math.max(0, remainingToPay - paidNow);

    // Only add to drawer if transitioning to Delivered now and payment was collected
    if (previousStatus !== 'Delivered' && paidNow > 0) {
      database.drawer_balances.cashInHand += paidNow;
    }

    // Recalculate profit
    const totalPartsCost = (repair.partsUsed || []).reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
    const ownCost = repair.personalCost || 0;
    repair.laborCost = Math.max(0, repair.finalCost - ownCost);
    repair.profit = Math.max(0, repair.finalCost - (totalPartsCost + ownCost));
  } else {
    // If not delivered, calculate remaining due based on current finalCost and advance
    repair.remainingDue = Math.max(0, repair.finalCost - repair.advancePaid);
    const totalPartsCost = (repair.partsUsed || []).reduce((sum, p) => sum + (p.costPrice * p.quantity), 0);
    const ownCost = repair.personalCost || 0;
    repair.laborCost = Math.max(0, repair.finalCost - ownCost);
    repair.profit = Math.max(0, repair.finalCost - (totalPartsCost + ownCost));
  }

  db.save();
  return res.json({
    message: `Repair #${repair.ticketNo} updated successfully`,
    repair
  });
});

// PUT /api/repairs/:id/customer (Edit Customer Name and Contact Number)
router.put('/:id/customer', requireAuth, requirePermission('repairs.updateStatus'), (req, res) => {
  const { customerName, customerPhone } = req.body;
  if (!customerName || !customerName.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const database = db.get();
  const repair = database.repairs.find(r => r.id === req.params.id);
  if (!repair) {
    return res.status(404).json({ error: 'Repair ticket not found' });
  }

  repair.customerName = customerName.trim();
  if (customerPhone !== undefined) {
    repair.customerPhone = customerPhone.trim();
  }

  db.save();
  return res.json({
    message: `Customer info for ticket #${repair.ticketNo} updated successfully`,
    repair
  });
});

// DELETE /api/repairs/:id (Delete repair job ticket)
router.delete('/:id', requireAuth, requirePermission('repairs.delete'), (req, res) => {
  const database = db.get();
  const index = database.repairs.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Repair ticket not found' });
  }

  const deleted = database.repairs[index];

  // Restock any parts attached to this repair ticket
  if (deleted.partsUsed && Array.isArray(deleted.partsUsed)) {
    for (const p of deleted.partsUsed) {
      if (p.itemId) {
        const item = database.items.find(i => i.id === p.itemId);
        if (item) {
          item.stockQuantity = (item.stockQuantity || 0) + (p.quantity || 1);
        }
      }
    }
  }

  database.repairs.splice(index, 1);
  db.save();

  return res.json({
    message: `Repair ticket #${deleted.ticketNo} deleted successfully`,
    deletedId: deleted.id
  });
});

module.exports = router;
