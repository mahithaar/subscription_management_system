const express = require('express');
const router = express.Router();
const { supabase, isSupabaseConfigured, memoryStore } = require('../db');
const timeMachine = require('../timeMachine');

router.get('/stats', async (req, res) => {
  const simulatedDate = await timeMachine.getCurrentDate();

  let customersCount = 0;
  let activeSubsCount = 0;
  let totalRevenue = 0;
  let overdueAmount = 0;
  let invoicesCount = 0;

  if (isSupabaseConfigured) {
    const { count: cCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    customersCount = cCount || 0;

    const { count: sCount } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active');
    activeSubsCount = sCount || 0;

    const { data: invoices } = await supabase.from('invoices').select('total_amount, status');
    if (invoices) {
      invoicesCount = invoices.length;
      invoices.forEach(inv => {
        if (inv.status === 'paid') totalRevenue += Number(inv.total_amount);
        if (inv.status === 'pending' || inv.status === 'overdue') overdueAmount += Number(inv.total_amount);
      });
    }
  } else {
    customersCount = memoryStore.customers.length;
    activeSubsCount = memoryStore.subscriptions.filter(s => s.status === 'active').length;
    invoicesCount = memoryStore.invoices.length;
    memoryStore.invoices.forEach(inv => {
      if (inv.status === 'paid') totalRevenue += Number(inv.total_amount);
      if (inv.status === 'pending' || inv.status === 'overdue') overdueAmount += Number(inv.total_amount);
    });
  }

  return res.json({
    simulated_date: simulatedDate,
    stats: {
      total_revenue: totalRevenue,
      monthly_recurring_revenue: activeSubsCount * 1000,
      active_subscriptions: activeSubsCount,
      total_customers: customersCount,
      overdue_amount: overdueAmount,
      total_invoices: invoicesCount
    }
  });
});

module.exports = router;
