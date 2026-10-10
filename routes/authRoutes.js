const express = require('express');
const router = express.Router();
const db = require('../db');
const { checkPassword, generateToken, requireAuth, hashPassword, getUserPermissions } = require('../auth');

// POST /api/auth/login (Username + Password)
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password' });
  }

  const database = db.get();
  const user = database.users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase() && u.active
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username' });
  }

  // Check password or pin fallback
  let isMatch = checkPassword(password, user.passwordHash, user.pin);
  if (!isMatch && password === user.pin) {
    isMatch = true;
  }

  if (!isMatch) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = generateToken(user);
  const userPermissions = getUserPermissions(user);
  return res.json({
    message: 'Login successful',
    token,
    permissions: userPermissions,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      permissions: userPermissions
    }
  });
});

// POST /api/auth/pin-login (Salesman quick PIN login on touch phones)
router.post('/pin-login', (req, res) => {
  const { pin, userId } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'Please enter PIN' });
  }

  const database = db.get();
  let user = null;
  if (userId) {
    user = database.users.find(u => u.id === userId && u.pin === pin.trim() && u.active);
  } else {
    user = database.users.find(u => u.pin === pin.trim() && u.active);
  }

  if (!user) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  const token = generateToken(user);
  const userPermissions = getUserPermissions(user);
  return res.json({
    message: 'Login successful',
    token,
    permissions: userPermissions,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      permissions: userPermissions
    }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

// GET /api/auth/salesmen-list (Public for quick salesman selector on phone login screen)
router.get('/salesmen-list', (req, res) => {
  const database = db.get();
  const salesmen = database.users
    .filter(u => u.active)
    .map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role
    }));
  return res.json({ salesmen });
});

module.exports = router;
