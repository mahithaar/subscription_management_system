const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const timeMachine = require('./timeMachine');
const subscriptionsRoutes = require('./routes/subscriptions');
const billingRoutes = require('./routes/billing');
const dashboardRoutes = require('./routes/dashboard');

const path = require('path');
const seed = require('./seed');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve Frontend static files reliably
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api', subscriptionsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Time Machine Routes (Person 4 Core Feature)
app.get('/api/time-machine', async (req, res) => {
  const date = await timeMachine.getCurrentDate();
  res.json({ simulated_date: date });
});

app.post('/api/time-machine/advance', async (req, res) => {
  const { days = 30 } = req.body;
  const nextDate = await timeMachine.advanceDays(Number(days));
  res.json({ message: `Advanced virtual clock by ${days} days`, simulated_date: nextDate });
});

app.post('/api/time-machine/reset', async (req, res) => {
  const today = await timeMachine.reset();
  res.json({ message: 'Reset virtual clock to real today', simulated_date: today });
});

app.listen(PORT, async () => {
  // Auto-seed sample data if empty so the dashboard is immediately populated
  try {
    await seed();
  } catch (err) {
    console.warn('Seeding note:', err.message);
  }
  console.log(`🚀 RecurOS Server running at: http://localhost:${PORT}`);
  console.log(`📊 Dashboard UI live at: http://localhost:${PORT}`);
  console.log(`⏱️ Time Machine active!`);
});
