const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const timeMachine = require('./timeMachine');
const seed = require('./seed');

// Route modules
const dashboardRoutes = require('./routes/dashboard');
const plansRoutes = require('./routes/plans');
const customersRoutes = require('./routes/customers');
const subscriptionsRoutes = require('./routes/subscriptions');
const invoicesRoutes = require('./routes/invoices');
const paymentsRoutes = require('./routes/payments');
const settingsRoutes = require('./routes/settings');
const billingRoutes = require('./routes/billing');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all frontend dev ports (Vite 5173, etc.)
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'RecurOS Subscription API'
  });
});

// Dedicated REST API Routes (Supporting both /api and /api/v1 prefixes)
const mountRoutes = (prefix) => {
  app.use(`${prefix}/dashboard`, dashboardRoutes);
  app.use(`${prefix}/plans`, plansRoutes);
  app.use(`${prefix}/customers`, customersRoutes);
  app.use(`${prefix}/subscriptions`, subscriptionsRoutes);
  app.use(`${prefix}/invoices`, invoicesRoutes);
  app.use(`${prefix}/payments`, paymentsRoutes);
  app.use(`${prefix}/settings`, settingsRoutes);
  app.use(`${prefix}/billing`, billingRoutes);

  // Time Machine Virtual Clock Endpoints
  app.get(`${prefix}/time-machine`, async (req, res) => {
    const date = await timeMachine.getCurrentDate();
    res.json({ simulated_date: date, today: date });
  });

  app.post(`${prefix}/time-machine/advance`, async (req, res) => {
    const { days = 30 } = req.body;
    const nextDate = await timeMachine.advanceDays(Number(days));
    res.json({ message: `Advanced virtual clock by ${days} days`, simulated_date: nextDate, today: nextDate });
  });

  app.post(`${prefix}/time-machine/reset`, async (req, res) => {
    const today = await timeMachine.reset();
    res.json({ message: 'Reset virtual clock to real today', simulated_date: today, today });
  });

  // Clock alias for compatibility
  app.get(`${prefix}/clock`, async (req, res) => {
    const date = await timeMachine.getCurrentDate();
    res.json({ today: date, is_simulated: date !== new Date().toISOString().split('T')[0] });
  });

  app.post(`${prefix}/clock/advance`, async (req, res) => {
    const { days = 30 } = req.body;
    const nextDate = await timeMachine.advanceDays(Number(days));
    res.json({ message: `Advanced virtual clock by ${days} days`, today: nextDate });
  });

  app.post(`${prefix}/clock/reset`, async (req, res) => {
    const today = await timeMachine.reset();
    res.json({ message: 'Reset virtual clock to real today', today });
  });

  // Auth convenience endpoints for frontend session
  app.post(`${prefix}/auth/login`, (req, res) => {
    res.json({
      access_token: 'mock-jwt-recuros-token-demo',
      token_type: 'bearer',
      user: {
        name: 'Alex Carter',
        email: 'admin@brightloop.io',
        role: 'admin'
      }
    });
  });

  app.get(`${prefix}/auth/me`, (req, res) => {
    res.json({
      name: 'Alex Carter',
      email: 'admin@brightloop.io',
      role: 'Administrator'
    });
  });
};

// Mount for both standard /api and versioned /api/v1
mountRoutes('/api');
mountRoutes('/api/v1');

// Serve React 19 UI (dist) if available, otherwise fallback to vanilla frontend
const viteDist = path.join(__dirname, '../frontend/recuros-ui/dist');
const fallbackFrontend = path.join(__dirname, '../frontend');

if (fs.existsSync(viteDist)) {
  console.log('📦 Serving React 19 Production Build from:', viteDist);
  app.use(express.static(viteDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(viteDist, 'index.html'));
  });
} else if (fs.existsSync(fallbackFrontend)) {
  app.use(express.static(fallbackFrontend));
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start Server & Auto-Seed
app.listen(PORT, async () => {
  console.log(`\n==================================================`);
  console.log(`🚀 RecurOS Subscription Billing Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard/stats`);
  console.log(`💳 Plans API: http://localhost:${PORT}/api/plans`);
  console.log(`👥 Customers API: http://localhost:${PORT}/api/customers`);
  console.log(`📝 Invoices API: http://localhost:${PORT}/api/invoices`);
  console.log(`⏱️ Time Machine: http://localhost:${PORT}/api/time-machine`);
  console.log(`🖥️ Web UI: http://localhost:${PORT}/`);
  console.log(`==================================================\n`);

  try {
    await seed();
  } catch (err) {
    console.warn('Seeding note:', err.message);
  }
});

module.exports = app;
