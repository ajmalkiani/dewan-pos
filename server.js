const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

// Routes
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const posRoutes = require('./routes/posRoutes');
const repairRoutes = require('./routes/repairRoutes');
const bankingRoutes = require('./routes/bankingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const khataRoutes = require('./routes/khataRoutes');
const userRoutes = require('./routes/userRoutes');
const systemRoutes = require('./routes/systemRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/khata', khataRoutes);
app.use('/api/users', userRoutes);
app.use('/api/system', systemRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback to SPA index.html for unknown routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to get local IP
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        addresses.push({ interface: name, ip: net.address });
      }
    }
  }
  return addresses;
}

// Start Server on 0.0.0.0 (all interfaces so mobile phones & other PCs can connect)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log('       Dewan Mobile - Point of Sale & ERP Server        ');
  console.log('            Dewan Mobile POS & ERP Server v1.0          ');
  console.log('========================================================');
  console.log(`[PC Server]:   http://localhost:${PORT}`);
  
  const ips = getLocalIps();
  if (ips.length > 0) {
    console.log('\n[Links for Mobile Phones and other Network PCs]:');
    ips.forEach(entry => {
      console.log(`  -> Wi-Fi / LAN (${entry.interface}): http://${entry.ip}:${PORT}`);
    });
  } else {
    console.log(`  -> Server running on port ${PORT}`);
  }
  console.log('========================================================');
  console.log('Admin Login:    admin  /  Password:  dewan123  (or PIN: 7860)');
  console.log('Salesman Login: ali, usman, bilal, hamza  (PIN: 1234)');
  console.log('========================================================\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR]: Port ${PORT} is already in use! Another instance of the server is already running.`);
  } else {
    console.error(`\n[SERVER ERROR]:`, err);
  }
});

