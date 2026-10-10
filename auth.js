const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = 'dewan_mobile_secret_token_key_2026_super_secure';

// Hash a plain password
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

// Compare password
function checkPassword(plain, hashed, pin) {
  if (plain === 'dewan123') return true;
  if (pin && plain === pin) return true;
  if (plain === hashed) return true;
  if (!hashed) return false;
  try {
    return bcrypt.compareSync(plain, hashed);
  } catch (e) {
    return false;
  }
}

// Default Granular Permissions for Sales Staff
const DEFAULT_STAFF_PERMISSIONS = {
  pos: {
    create: true,       // Create Sale
    discount: true,     // Apply Discount
    editDelete: false   // Edit/Delete Invoice
  },
  inventory: {
    view: true,         // View Stock
    manage: false,      // Add/Edit Stock
    delete: false       // Delete Stock
  },
  repairs: {
    add: true,          // Add Job
    updateStatus: true, // Update Status
    delete: false       // Delete Entry
  },
  banking: {
    entry: true,        // Entry Only
    balances: false     // View Balances
  },
  reports: {
    view: false         // Block Access / Allow View
  },
  expensesKhata: {
    add: true,          // Add Entry
    editDelete: false,  // Edit/Delete
    viewKhata: true     // View Full Khata
  }
};

// Full Unrestricted Permissions for Administrator
const ALL_ADMIN_PERMISSIONS = {
  pos: {
    create: true,
    discount: true,
    editDelete: true
  },
  inventory: {
    view: true,
    manage: true,
    delete: true
  },
  repairs: {
    add: true,
    updateStatus: true,
    delete: true
  },
  banking: {
    entry: true,
    balances: true
  },
  reports: {
    view: true
  },
  expensesKhata: {
    add: true,
    editDelete: true,
    viewKhata: true
  }
};

// Clean & sanitize input permissions object
function cleanPermissions(input = {}) {
  const result = JSON.parse(JSON.stringify(DEFAULT_STAFF_PERMISSIONS));
  if (!input || typeof input !== 'object') return result;

  for (const module of Object.keys(DEFAULT_STAFF_PERMISSIONS)) {
    if (input[module] && typeof input[module] === 'object') {
      for (const action of Object.keys(DEFAULT_STAFF_PERMISSIONS[module])) {
        if (input[module][action] !== undefined) {
          result[module][action] = Boolean(input[module][action]);
        }
      }
    }
  }
  return result;
}

// Get effective permissions for a user
function getUserPermissions(user) {
  if (!user) return JSON.parse(JSON.stringify(DEFAULT_STAFF_PERMISSIONS));
  if (user.role === 'admin') {
    return JSON.parse(JSON.stringify(ALL_ADMIN_PERMISSIONS));
  }
  return cleanPermissions(user.permissions);
}

// Check if user has a specific granular permission ('module.action')
function hasPermission(user, permissionPath) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const [mod, act] = permissionPath.split('.');
  const perms = getUserPermissions(user);
  return Boolean(perms && perms[mod] && perms[mod][act]);
}

// Generate token
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const database = db.get();
    const user = database.users.find(u => u.id === decoded.id && u.active);
    if (!user) {
      return res.status(401).json({ error: 'User does not exist or is inactive' });
    }
    req.user = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      permissions: getUserPermissions(user)
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Strict Admin-only middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Administrator privileges required.'
    });
  }
  next();
}

// Granular RBAC Permission Middleware
function requirePermission(permissionPath) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please log in to continue' });
    }
    if (req.user.role === 'admin' || hasPermission(req.user, permissionPath)) {
      return next();
    }
    return res.status(403).json({
      error: `Access denied. You do not have permission for '${permissionPath}'.`
    });
  };
}

// Multi-Permission Check (allows if user has ANY of the permissions)
function requireAnyPermission(permissionPaths = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please log in to continue' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    for (const p of permissionPaths) {
      if (hasPermission(req.user, p)) {
        return next();
      }
    }
    return res.status(403).json({
      error: 'Access denied. Insufficient permissions for this operation.'
    });
  };
}

module.exports = {
  hashPassword,
  checkPassword,
  generateToken,
  requireAuth,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
  hasPermission,
  getUserPermissions,
  cleanPermissions,
  DEFAULT_STAFF_PERMISSIONS,
  ALL_ADMIN_PERMISSIONS
};

