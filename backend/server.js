const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

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

// Enable CORS for all frontend dev ports (Vite 5173, React 3000, etc.)
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

// Dedicated REST API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing', billingRoutes);

// Time Machine Virtual Clock Endpoints
app.get('/api/time-machine', async (req, res) => {
  const date = await timeMachine.getCurrentDate();
  res.json({ simulated_date: date, today: date });
});

app.post('/api/time-machine/advance', async (req, res) => {
  const { days = 30 } = req.body;
  const nextDate = await timeMachine.advanceDays(Number(days));
  res.json({ message: `Advanced virtual clock by ${days} days`, simulated_date: nextDate, today: nextDate });
});

app.post('/api/time-machine/reset', async (req, res) => {
  const today = await timeMachine.reset();
  res.json({ message: 'Reset virtual clock to real today', simulated_date: today, today });
});

// Clock alias for compatibility
app.get('/api/clock', async (req, res) => {
  const date = await timeMachine.getCurrentDate();
  res.json({ today: date, is_simulated: date !== new Date().toISOString().split('T')[0] });
});

app.post('/api/clock/advance', async (req, res) => {
  const { days = 30 } = req.body;
  const nextDate = await timeMachine.advanceDays(Number(days));
  res.json({ message: `Advanced virtual clock by ${days} days`, today: nextDate });
});

// Auth convenience endpoints for frontend session
app.post('/api/auth/login', (req, res) => {
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

app.get('/api/auth/me', (req, res) => {
  res.json({
    name: 'Alex Carter',
    email: 'admin@brightloop.io',
    role: 'Administrator'
  });
});

// Serve frontend static files if available
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

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
  console.log(`==================================================\n`);

  try {
    await seed();
  } catch (err) {
    console.warn('Seeding note:', err.message);
  }
});

module.exports = app;
