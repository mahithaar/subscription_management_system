const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');
const crypto = require('crypto');

// 1. Get all plans
router.get('/', (req, res) => {
  const plans = memoryStore.plans.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    monthlyPrice: p.monthly_price || p.base_price,
    monthly_price: p.monthly_price || p.base_price,
    yearlyPrice: p.yearly_price || ((p.monthly_price || p.base_price) * 12 * 0.8), // 20% discount on yearly
    yearly_price: p.yearly_price || ((p.monthly_price || p.base_price) * 12 * 0.8),
    yearlyDiscount: "20%",
    currency: p.currency || 'INR',
    currencySymbol: '₹',
    period: p.period || 'per month',
    popular: Boolean(p.popular),
    isPopular: Boolean(p.popular),
    activeSubscribers: p.activeSubscribers || 0,
    mrr: p.mrr || `₹${((p.activeSubscribers || 0) * (p.monthly_price || p.base_price)).toLocaleString('en-IN')}`,
    features: p.features || []
  }));

  return res.json(plans);
});

// 2. Get single plan
router.get('/:id', (req, res) => {
  const plan = memoryStore.plans.find(p => p.id === req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  return res.json(plan);
});

// 3. Create new plan (Interactive "Add New Plan" modal in PlansView.jsx)
router.post('/', (req, res) => {
  const { 
    name, 
    description = '', 
    price, 
    monthlyPrice, 
    yearlyPrice, 
    features = [], 
    currency = 'INR', 
    popular = false 
  } = req.body;

  if (!name || (!price && !monthlyPrice)) {
    return res.status(400).json({ error: 'Plan name and price are required' });
  }

  const basePrice = Number(monthlyPrice || price.toString().replace(/[^0-9.]/g, '') || 999);
  const calculatedYearly = Number(yearlyPrice || Math.round(basePrice * 12 * 0.8));

  const newPlan = {
    id: `plan-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString().slice(-4)}`,
    name,
    description,
    price: `₹${basePrice.toLocaleString('en-IN')}`,
    base_price: basePrice,
    monthly_price: basePrice,
    yearly_price: calculatedYearly,
    currency,
    period: 'per month',
    popular: Boolean(popular),
    activeSubscribers: 0,
    mrr: '₹0',
    features: Array.isArray(features) ? features : [features]
  };

  memoryStore.plans.push(newPlan);
  console.log(`✨ [Plans] New plan created: ${newPlan.name} (${newPlan.price})`);
  return res.status(201).json(newPlan);
});

// 4. Update plan
router.put('/:id', (req, res) => {
  const index = memoryStore.plans.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Plan not found' });

  const current = memoryStore.plans[index];
  const updated = {
    ...current,
    ...req.body,
    id: current.id // preserve ID
  };

  if (req.body.monthlyPrice) {
    updated.base_price = Number(req.body.monthlyPrice);
    updated.monthly_price = Number(req.body.monthlyPrice);
    updated.price = `₹${updated.base_price.toLocaleString('en-IN')}`;
  }

  memoryStore.plans[index] = updated;
  return res.json(updated);
});

// 5. Delete plan
router.delete('/:id', (req, res) => {
  const index = memoryStore.plans.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Plan not found' });

  const deleted = memoryStore.plans.splice(index, 1);
  return res.json({ success: true, deleted: deleted[0] });
});

module.exports = router;
