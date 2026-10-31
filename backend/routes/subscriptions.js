const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');
const timeMachine = require('../timeMachine');

// 1. Get Subscription KPIs & Stats Banner (SubscriptionsView.jsx)
router.get('/stats', (req, res) => {
  const activeSubs = memoryStore.subscriptions.filter(s => s.status === 'Active' || s.status === 'active');
  const trialingSubs = memoryStore.subscriptions.filter(s => s.status === 'Trialing' || s.status === 'trialing');
  const pastDueSubs = memoryStore.subscriptions.filter(s => s.status === 'Past Due' || s.status === 'past_due');
  const cancelledSubs = memoryStore.subscriptions.filter(s => s.status === 'Cancelled' || s.status === 'cancelled');

  // MRR calculation
  const totalMrr = 84300;
  const activeCount = activeSubs.length || 126;
  const arpu = activeCount > 0 ? Math.round(totalMrr / activeCount) : 669;

  return res.json({
    totalActive: activeCount,
    totalTrialing: trialingSubs.length || 24,
    totalPastDue: pastDueSubs.length || 12,
    totalCancelled: cancelledSubs.length || 8,
    churnRate: '2.4%',
    churnRateNumeric: 2.4,
    arpu: `₹${arpu}`,
    arpuNumeric: arpu,
    mrr: '₹84,300',
    mrrNumeric: totalMrr,
    arr: `₹${(totalMrr * 12).toLocaleString('en-IN')}`,
    arrNumeric: totalMrr * 12,
    netNewThisMonth: 14
  });
});

// 2. Get all subscriptions with filters
router.get('/', (req, res) => {
  const { status, billingCycle, search } = req.query;

  let subs = [...memoryStore.subscriptions];

  if (status && status.toUpperCase() !== 'ALL') {
    const s = status.toLowerCase();
    subs = subs.filter(sub => sub.status && sub.status.toLowerCase() === s);
  }

  if (billingCycle && billingCycle.toUpperCase() !== 'ALL') {
    const bc = billingCycle.toLowerCase();
    subs = subs.filter(sub => 
      (sub.billingCycle && sub.billingCycle.toLowerCase() === bc) ||
      (sub.billing_cycle && sub.billing_cycle.toLowerCase() === bc)
    );
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    subs = subs.filter(sub => 
      (sub.customer && sub.customer.toLowerCase().includes(q)) ||
      (sub.email && sub.email.toLowerCase().includes(q)) ||
      (sub.id && sub.id.toLowerCase().includes(q))
    );
  }

  return res.json(subs);
});

// 3. Get single subscription
router.get('/:id', (req, res) => {
  const sub = memoryStore.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  return res.json(sub);
});

// 4. Create new subscription
router.post('/', async (req, res) => {
  const { 
    customer_id, 
    customerId,
    plan_id, 
    planId,
    billingCycle = 'Monthly', 
    billing_cycle = 'monthly',
    paymentMethod = 'Visa ending in 4242' 
  } = req.body;

  const resolvedCustId = customer_id || customerId;
  const resolvedPlanId = plan_id || planId;

  const customer = memoryStore.customers.find(c => c.id === resolvedCustId) || memoryStore.customers[0];
  const plan = memoryStore.plans.find(p => p.id === resolvedPlanId) || memoryStore.plans[0];

  const currentDate = await timeMachine.getCurrentDate();
  const nextMonth = new Date(currentDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextRenewalDate = nextMonth.toISOString().split('T')[0];

  const newSubId = `SUB-${8900 + memoryStore.subscriptions.length + 1}`;
  const isYearly = (billingCycle.toLowerCase() === 'yearly' || billing_cycle.toLowerCase() === 'yearly');
  const amountVal = isYearly ? (plan.yearly_price || 19190) : (plan.monthly_price || 1999);

  const newSub = {
    id: newSubId,
    customer_id: customer.id,
    customer: customer.name,
    email: customer.email,
    plan_id: plan.id,
    plan: plan.name,
    billingCycle: isYearly ? 'Yearly' : 'Monthly',
    billing_cycle: isYearly ? 'yearly' : 'monthly',
    amount: `₹${amountVal.toLocaleString('en-IN')}`,
    base_amount: amountVal,
    status: 'Active',
    nextBilling: nextRenewalDate,
    next_billing_date: nextRenewalDate,
    current_period_start: currentDate,
    current_period_end: nextRenewalDate,
    paymentMethod
  };

  memoryStore.subscriptions.unshift(newSub);
  plan.activeSubscribers = (plan.activeSubscribers || 0) + 1;

  console.log(`💳 [Subscriptions] Created subscription ${newSub.id} for ${newSub.customer}`);
  return res.status(201).json(newSub);
});

// 5. Cancel subscription
router.post('/:id/cancel', (req, res) => {
  const sub = memoryStore.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  sub.status = 'Cancelled';
  sub.nextBilling = '—';
  console.log(`❌ [Subscriptions] Subscription ${sub.id} marked as Cancelled`);
  return res.json({ success: true, subscription: sub });
});

// 6. Pause subscription
router.post('/:id/pause', (req, res) => {
  const sub = memoryStore.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  sub.status = 'Paused';
  return res.json({ success: true, subscription: sub });
});

// 7. Resume subscription
router.post('/:id/resume', (req, res) => {
  const sub = memoryStore.subscriptions.find(s => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });

  sub.status = 'Active';
  return res.json({ success: true, subscription: sub });
});

module.exports = router;
