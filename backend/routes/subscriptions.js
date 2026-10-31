const express = require('express');
const router = express.Router();
const { supabase, isSupabaseConfigured, memoryStore } = require('../db');
const timeMachine = require('../timeMachine');
const crypto = require('crypto');

// 1. Get all products and plans
router.get('/plans', async (req, res) => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('plans').select('*, products(name, description)');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  return res.json(memoryStore.plans);
});

// 2. Create a new plan
router.post('/plans', async (req, res) => {
  const { name, billing_period, base_price, currency = 'INR', product_id } = req.body;
  if (!name || !base_price || !billing_period) {
    return res.status(400).json({ error: 'Missing name, billing_period, or base_price' });
  }

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('plans').insert([{
      name, billing_period, base_price, currency, product_id
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  const newPlan = {
    id: crypto.randomUUID(),
    name,
    billing_period,
    base_price: parseFloat(base_price),
    currency,
    product_id: product_id || null,
    created_at: new Date().toISOString()
  };
  memoryStore.plans.push(newPlan);
  return res.status(201).json(newPlan);
});

// 3. Get all customers
router.get('/customers', async (req, res) => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('customers').select('*');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  return res.json(memoryStore.customers);
});

// 4. Create customer
router.post('/customers', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('customers').insert([{ name, email, phone }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  const newCustomer = {
    id: crypto.randomUUID(),
    name,
    email,
    phone: phone || '',
    created_at: new Date().toISOString()
  };
  memoryStore.customers.push(newCustomer);
  return res.status(201).json(newCustomer);
});

// 5. Get all subscriptions
router.get('/subscriptions', async (req, res) => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, customers(name, email), plans(name, base_price, billing_period, currency)');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  const enriched = memoryStore.subscriptions.map(s => ({
    ...s,
    customer: memoryStore.customers.find(c => c.id === s.customer_id),
    plan: memoryStore.plans.find(p => p.id === s.plan_id)
  }));
  return res.json(enriched);
});

// 6. Create customer subscription
router.post('/subscriptions', async (req, res) => {
  const { customer_id, plan_id } = req.body;
  if (!customer_id || !plan_id) {
    return res.status(400).json({ error: 'customer_id and plan_id are required' });
  }

  const simulatedDate = await timeMachine.getCurrentDate();
  const startDate = new Date(simulatedDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30); // 30-day default cycle

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('subscriptions').insert([{
      customer_id,
      plan_id,
      status: 'active',
      start_date: startStr,
      current_period_start: startStr,
      current_period_end: endStr,
      next_billing_date: startStr // due immediately upon creation!
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  const newSub = {
    id: crypto.randomUUID(),
    customer_id,
    plan_id,
    status: 'active',
    start_date: startStr,
    current_period_start: startStr,
    current_period_end: endStr,
    next_billing_date: startStr,
    created_at: new Date().toISOString()
  };
  memoryStore.subscriptions.push(newSub);
  return res.status(201).json(newSub);
});

module.exports = router;
