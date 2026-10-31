const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');

// 1. Get all customers (with search & status filters matching CustomersView.jsx)
router.get('/', (req, res) => {
  const { search, status, page = 1, limit = 50 } = req.query;

  let filtered = [...memoryStore.customers];

  // Search filter
  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }

  // Status filter (ALL, ACTIVE, TRIALING, PAST DUE, CANCELLED)
  if (status && status.toUpperCase() !== 'ALL') {
    const s = status.toLowerCase();
    filtered = filtered.filter(c => c.status && c.status.toLowerCase() === s);
  }

  return res.json({
    customers: filtered,
    total: filtered.length,
    page: Number(page),
    limit: Number(limit)
  });
});

// 2. Get customer by ID
router.get('/:id', (req, res) => {
  const customer = memoryStore.customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Attach associated subscriptions & recent invoices
  const subs = memoryStore.subscriptions.filter(s => s.customer_id === customer.id);
  const invs = memoryStore.invoices.filter(i => i.customer_id === customer.id);

  return res.json({
    ...customer,
    subscriptions: subs,
    invoices: invs
  });
});

// 3. Create new customer
router.post('/', (req, res) => {
  const { name, email, company = '', phone = '', plan = 'Starter Solo' } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'CU';
  const newId = `CUST-${String(memoryStore.customers.length + 1).padStart(3, '0')}`;

  const newCustomer = {
    id: newId,
    name,
    email,
    company: company || `${name}'s Organization`,
    plan,
    status: 'Active',
    spent: '₹0',
    lifetime_spend: 0,
    joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    avatar: initials,
    phone
  };

  memoryStore.customers.unshift(newCustomer);
  console.log(`👤 [Customers] Created customer: ${newCustomer.name} (${newCustomer.email})`);
  return res.status(201).json(newCustomer);
});

// 4. Update customer
router.put('/:id', (req, res) => {
  const index = memoryStore.customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const updated = {
    ...memoryStore.customers[index],
    ...req.body,
    id: memoryStore.customers[index].id
  };

  memoryStore.customers[index] = updated;
  return res.json(updated);
});

// 5. Delete customer
router.delete('/:id', (req, res) => {
  const index = memoryStore.customers.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const deleted = memoryStore.customers.splice(index, 1);
  return res.json({ success: true, customer: deleted[0] });
});

module.exports = router;
