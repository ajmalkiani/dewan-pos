const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin, hashPassword, getUserPermissions, cleanPermissions, ALL_ADMIN_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } = require('../auth');

// GET /api/users (List all users - Admin only)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const database = db.get();
  const safeUsers = database.users.map(u => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    pin: u.pin,
    phone: u.phone,
    active: u.active,
    createdAt: u.createdAt,
    permissions: getUserPermissions(u)
  }));
  return res.json({ users: safeUsers });
});

// POST /api/users (Create new administrator or staff account - Admin only)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { username, fullName, pin, password, phone, role, permissions } = req.body;

  if (!username || !fullName) {
    return res.status(400).json({ error: 'Please enter username and full name' });
  }

  const database = db.get();
  const exists = database.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'This username is already taken. Please choose another.' });
  }

  const targetRole = role === 'admin' ? 'admin' : 'salesman';
  const plainPass = (password && password.trim() !== '') ? password.trim() : (pin ? pin.trim() : (targetRole === 'admin' ? 'dewan123' : '1234'));
  const hashed = hashPassword(plainPass);

  const userPermissions = targetRole === 'admin'
    ? JSON.parse(JSON.stringify(ALL_ADMIN_PERMISSIONS))
    : cleanPermissions(permissions || DEFAULT_STAFF_PERMISSIONS);

  const newUser = {
    id: 'u_' + Date.now(),
    username: username.trim().toLowerCase(),
    passwordHash: hashed,
    fullName: fullName.trim(),
    role: targetRole,
    pin: pin ? pin.trim() : (targetRole === 'admin' ? '7860' : '1234'),
    phone: phone ? phone.trim() : '',
    active: true,
    permissions: userPermissions,
    createdAt: new Date().toISOString()
  };

  database.users.push(newUser);
  db.save();

  const roleTitle = targetRole === 'admin' ? 'Administrator' : 'Staff member';
  return res.status(201).json({
    message: `${roleTitle} "${newUser.fullName}" added successfully`,
    user: {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      role: newUser.role,
      pin: newUser.pin,
      phone: newUser.phone,
      active: newUser.active,
      permissions: newUser.permissions
    }
  });
});

// PUT /api/users/:id (Edit staff / user account - Admin only)
router.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const database = db.get();
  const user = database.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { username, fullName, pin, password, phone, active, role, permissions } = req.body;

  if (fullName !== undefined && fullName.trim() !== '') {
    user.fullName = fullName.trim();
  }
  if (phone !== undefined) {
    user.phone = phone.trim();
  }
  if (active !== undefined) {
    user.active = Boolean(active);
  }
  if (role !== undefined && user.username !== 'admin') {
    user.role = role === 'admin' ? 'admin' : 'salesman';
  }
  if (pin !== undefined && pin.trim() !== '') {
    user.pin = pin.trim();
  }
  if (username !== undefined && user.username !== 'admin') {
    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername && trimmedUsername !== user.username.toLowerCase()) {
      const duplicate = database.users.find(u => u.id !== req.params.id && u.username.toLowerCase() === trimmedUsername);
      if (duplicate) {
        return res.status(400).json({ error: `Username "${trimmedUsername}" is already taken by another account.` });
      }
      user.username = trimmedUsername;
    }
  }
  if (password && password.trim() !== '') {
    user.passwordHash = hashPassword(password.trim());
  }

  // Update permissions
  if (user.role === 'admin') {
    user.permissions = JSON.parse(JSON.stringify(ALL_ADMIN_PERMISSIONS));
  } else if (permissions !== undefined) {
    user.permissions = cleanPermissions(permissions);
  } else if (!user.permissions) {
    user.permissions = JSON.parse(JSON.stringify(DEFAULT_STAFF_PERMISSIONS));
  }

  db.save();

  return res.json({
    message: `Account "${user.fullName}" (@${user.username}) updated successfully`,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      pin: user.pin,
      phone: user.phone,
      active: user.active,
      permissions: getUserPermissions(user)
    }
  });
});

// DELETE /api/users/:id (Delete sale staff / user - Admin only)
router.delete('/:id', requireAuth, requireAdmin, (req, res) => {
  const database = db.get();
  const index = database.users.findIndex(u => u.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'User account not found' });
  }

  const user = database.users[index];

  // Prevent deleting the primary root administrator account
  if (user.username && user.username.toLowerCase() === 'admin') {
    return res.status(400).json({ error: 'Cannot delete the primary root administrator account.' });
  }

  // Prevent admin from deleting their own currently logged-in account
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own currently logged-in account.' });
  }

  const deleted = database.users.splice(index, 1)[0];
  db.save();

  return res.json({
    message: `Account "${deleted.fullName}" (@${deleted.username}) deleted successfully`,
    deletedId: deleted.id
  });
});

module.exports = router;

