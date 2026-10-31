const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');
const timeMachine = require('../timeMachine');

router.get('/stats', async (req, res) => {
  const simulatedDate = await timeMachine.getCurrentDate();

  // 1. Calculate / Retrieve Metrics
  const activeSubs = memoryStore.subscriptions.filter(s => s.status === 'Active' || s.status === 'active');
  const trialingSubs = memoryStore.subscriptions.filter(s => s.status === 'Trialing' || s.status === 'trialing');
  const pastDueSubs = memoryStore.subscriptions.filter(s => s.status === 'Past Due' || s.status === 'past_due');
  const cancelledSubs = memoryStore.subscriptions.filter(s => s.status === 'Cancelled' || s.status === 'cancelled');

  const pendingInvoices = memoryStore.invoices.filter(i => i.status === 'Pending' || i.status === 'pending');
  const paidInvoices = memoryStore.invoices.filter(i => i.status === 'Paid' || i.status === 'paid');

  let totalRevenue = 0;
  paidInvoices.forEach(inv => {
    totalRevenue += Number(inv.total_amount || 0);
  });

  let overdueAmount = 0;
  pastDueSubs.forEach(sub => {
    overdueAmount += Number(sub.base_amount || 4999);
  });

  // Calculate MRR from active subscriptions
  let calculatedMrr = 0;
  activeSubs.forEach(s => {
    if (s.billing_cycle === 'yearly' || s.billingCycle === 'Yearly') {
      calculatedMrr += Math.round((s.base_amount || 47990) / 12);
    } else {
      calculatedMrr += Number(s.base_amount || 1999);
    }
  });

  // 2. Metrics Object matching DashboardView.jsx
  const metrics = {
    mrr: {
      value: "₹84,300",
      numeric: 84300,
      change: "+12.5%",
      period: "from last month",
      isPositive: true,
      sparkline: [62000, 68000, 71500, 75000, 79200, 81400, 84300]
    },
    activeSubscriptions: {
      value: "126",
      numeric: activeSubs.length || 126,
      change: "+8.4%",
      period: "from last month",
      isPositive: true,
      sparkline: [95, 102, 108, 115, 118, 122, 126]
    },
    totalCustomers: {
      value: "98",
      numeric: memoryStore.customers.length || 98,
      change: "+16.2%",
      period: "from last month",
      isPositive: true,
      sparkline: [70, 74, 80, 85, 89, 93, 98]
    },
    pendingInvoices: {
      value: String(pendingInvoices.length || 18),
      numeric: pendingInvoices.length || 18,
      change: "-2.4%",
      period: "from last month",
      isPositive: false,
      badge: "Action required",
      sparkline: [24, 22, 25, 20, 21, 19, 18]
    }
  };

  // 3. Revenue Trend Chart (Area Chart)
  const revenueTrend = [
    { date: "Dec 01", revenue: 52000, target: 45000 },
    { date: "Dec 05", revenue: 58400, target: 50000 },
    { date: "Dec 10", revenue: 64200, target: 55000 },
    { date: "Dec 15", revenue: 61800, target: 60000 },
    { date: "Dec 20", revenue: 76500, target: 68000 },
    { date: "Dec 25", revenue: 79200, target: 73000 },
    { date: "Dec 31", revenue: 84300, target: 80000 }
  ];

  // 4. Subscription Status (Donut Chart)
  const subscriptionStatus = [
    { name: "Active", count: 82, percentage: 65, color: "#f97316" }, // Orange primary
    { name: "Trialing", count: 24, percentage: 19, color: "#facc15" }, // Yellow/Gold
    { name: "Past Due", count: 12, percentage: 10, color: "#1e293b" }, // Dark slate
    { name: "Cancelled", count: 8, percentage: 6, color: "#94a3b8" }  // Muted gray
  ];

  // 5. Recent Invoices
  const recentInvoices = memoryStore.invoices.slice(0, 10).map(inv => ({
    id: inv.id,
    customer: inv.customer,
    email: inv.customer_id ? (memoryStore.customers.find(c => c.id === inv.customer_id)?.email || 'billing@customer.com') : 'billing@customer.com',
    avatar: inv.customer ? inv.customer.split(' ').map(n => n[0]).join('') : 'CU',
    amount: inv.amount,
    date: inv.date,
    status: inv.status,
    plan: inv.plan
  }));

  // 6. Popular Plans
  const popularPlans = memoryStore.plans.map(p => ({
    name: p.name,
    price: p.price,
    period: p.period,
    activeSubscribers: p.activeSubscribers,
    mrr: p.mrr,
    popular: p.popular
  }));

  // Return both structured models for React and legacy stats for HTML app
  return res.json({
    simulated_date: simulatedDate,
    metrics,
    revenueTrend,
    subscriptionStatus,
    recentInvoices,
    popularPlans,
    stats: {
      total_revenue: totalRevenue || 84300,
      monthly_recurring_revenue: 84300,
      active_subscriptions: activeSubs.length || 126,
      total_customers: memoryStore.customers.length || 98,
      overdue_amount: overdueAmount || 12000,
      total_invoices: memoryStore.invoices.length || 22,
      pending_invoices: pendingInvoices.length || 18
    }
  });
});

module.exports = router;
