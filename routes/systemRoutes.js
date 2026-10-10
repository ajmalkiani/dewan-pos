const express = require('express');
const router = express.Router();
const os = require('os');
const QRCode = require('qrcode');
const db = require('../db');
const { requireAuth, requireAdmin, checkPassword } = require('../auth');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'dewan_mobile_secret_token_key_2026_super_secure';

// Helper to verify if input matches any active admin's password or PIN
function verifyAdminCredentials(passwordOrPin) {
  if (!passwordOrPin || typeof passwordOrPin !== 'string') return false;
  const trimmed = passwordOrPin.trim();
  const database = db.get();
  const admins = (database.users || []).filter(u => u.role === 'admin' && u.active);
  for (const admin of admins) {
    if (checkPassword(trimmed, admin.passwordHash, admin.pin)) {
      return true;
    }
  }
  return false;
}

// Helper to check if authorization header contains valid admin JWT
function checkAdminToken(authHeader) {
  if (!authHeader) return false;
  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = jwt.verify(token, JWT_SECRET);
    const database = db.get();
    const user = (database.users || []).find(u => u.id === decoded.id && u.active);
    return user && user.role === 'admin';
  } catch (e) {
    return false;
  }
}

// Get primary local IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let fallbackIp = '127.0.0.1';

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        if (!net.address.startsWith('169.254')) {
          return net.address;
        }
      }
    }
  }
  return fallbackIp;
}

// Handler for network-info - Admin Password / PIN Protected
async function handleNetworkInfoRequest(req, res) {
  const adminPassword = req.body?.adminPassword || req.query?.adminPassword || req.headers['x-admin-password'];
  let isAuthorized = false;

  if (adminPassword && typeof adminPassword === 'string') {
    isAuthorized = verifyAdminCredentials(adminPassword);
  }

  if (!isAuthorized && req.headers.authorization) {
    isAuthorized = checkAdminToken(req.headers.authorization);
  }

  if (!isAuthorized) {
    return res.status(403).json({
      error: 'Incorrect Admin password or PIN. Access denied.'
    });
  }

  const port = process.env.PORT || 5000;
  const ip = getLocalIpAddress();
  const serverUrl = `http://${ip}:${port}`;

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(serverUrl, {
      margin: 2,
      width: 250,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR code generation error:', err);
  }

  return res.json({
    localIp: ip,
    port: port,
    serverUrl: serverUrl,
    qrCodeDataUrl: qrCodeDataUrl,
    osPlatform: os.platform(),
    osHostname: os.hostname()
  });
}

// POST and GET /api/system/network-info (Admin Password Protected)
router.post('/network-info', handleNetworkInfoRequest);
router.get('/network-info', handleNetworkInfoRequest);

// GET /api/system/settings
router.get('/settings', (req, res) => {
  const database = db.get();
  return res.json({ settings: database.shop_settings });
});

// PUT /api/system/settings (Admin only)
router.put('/settings', requireAuth, requireAdmin, (req, res) => {
  const database = db.get();
  const { name, tagline, address, phone, footerNote } = req.body;

  if (name) database.shop_settings.name = name.trim();
  if (tagline !== undefined) database.shop_settings.tagline = tagline.trim();
  if (address !== undefined) database.shop_settings.address = address.trim();
  if (phone !== undefined) database.shop_settings.phone = phone.trim();
  if (footerNote !== undefined) database.shop_settings.footerNote = footerNote.trim();

  db.save();
  return res.json({
    message: 'Shop settings updated successfully',
    settings: database.shop_settings
  });
});

// GET /api/system/backup (Admin only - Download DB JSON)
router.get('/backup', requireAuth, requireAdmin, (req, res) => {
  const database = db.get();
  const filename = `dewan_mobile_backup_${new Date().toISOString().split('T')[0]}.json`;
  
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.setHeader('Content-type', 'application/json');
  return res.send(JSON.stringify(database, null, 2));
});

// POST /api/system/create-backup-point (Admin only)
router.post('/create-backup-point', requireAuth, requireAdmin, (req, res) => {
  db.backup();
  const backups = db.getBackupsList();
  return res.json({
    message: 'Backup point created successfully',
    backups
  });
});

// GET /api/system/backups-list (Admin only)
router.get('/backups-list', requireAuth, requireAdmin, (req, res) => {
  const backups = db.getBackupsList();
  return res.json({ backups });
});

// POST /api/system/restore-backup (Admin only)
router.post('/restore-backup', requireAuth, requireAdmin, (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Please select a backup file' });
  }

  try {
    db.restoreBackup(filename);
    return res.json({ message: 'Backup restored successfully' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
