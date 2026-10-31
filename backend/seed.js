const { supabase, isSupabaseConfigured, memoryStore } = require('./db');
const crypto = require('crypto');

async function seed() {
  console.log('🌱 Starting RecurOS Database Seeding...');

  const sampleProducts = [
    { id: crypto.randomUUID(), name: 'RecurOS Platform', description: 'Core recurring billing platform' }
  ];

  const samplePlans = [
    { id: crypto.randomUUID(), product_id: sampleProducts[0].id, name: 'Starter Plan', billing_period: 'monthly', base_price: 499.00, currency: 'INR' },
    { id: crypto.randomUUID(), product_id: sampleProducts[0].id, name: 'Software Pro', billing_period: 'monthly', base_price: 1000.00, currency: 'INR' },
    { id: crypto.randomUUID(), product_id: sampleProducts[0].id, name: 'Enterprise Annual', billing_period: 'yearly', base_price: 10000.00, currency: 'INR' }
  ];

  const sampleCustomers = [
    { id: crypto.randomUUID(), name: 'Acme Technologies', email: 'billing@acme.com', phone: '+91 9876543210' },
    { id: crypto.randomUUID(), name: 'Brightloop Labs', email: 'finance@brightloop.io', phone: '+91 9876543211' },
    { id: crypto.randomUUID(), name: 'Mahi Solutions', email: 'mahi@solution.org', phone: '+91 9876543212' },
    { id: crypto.randomUUID(), name: 'Rakesh Innovations', email: 'rakesh@innovate.co', phone: '+91 9876543213' }
  ];

  const todayStr = new Date().toISOString().split('T')[0];
  const past30Str = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const next30Str = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const sampleSubscriptions = [
    {
      id: crypto.randomUUID(),
      customer_id: sampleCustomers[0].id,
      plan_id: samplePlans[1].id, // Software Pro (1000/mo)
      status: 'active',
      start_date: past30Str,
      current_period_start: past30Str,
      current_period_end: todayStr,
      next_billing_date: todayStr // Due today!
    },
    {
      id: crypto.randomUUID(),
      customer_id: sampleCustomers[1].id,
      plan_id: samplePlans[2].id, // Enterprise (10000/yr)
      status: 'active',
      start_date: past30Str,
      current_period_start: past30Str,
      current_period_end: next30Str,
      next_billing_date: next30Str // Due in 30 days
    },
    {
      id: crypto.randomUUID(),
      customer_id: sampleCustomers[2].id,
      plan_id: samplePlans[0].id, // Starter (499/mo)
      status: 'active',
      start_date: past30Str,
      current_period_start: past30Str,
      current_period_end: todayStr,
      next_billing_date: todayStr // Due today!
    }
  ];

  const sampleInvoices = [
    {
      id: crypto.randomUUID(),
      subscription_id: sampleSubscriptions[1].id,
      customer_id: sampleCustomers[1].id,
      billing_period_start: past30Str,
      billing_period_end: next30Str,
      base_price: 10000.00,
      addon_amount: 0.00,
      discount_amount: 500.00,
      tax_amount: 1710.00,
      total_amount: 11210.00,
      status: 'paid',
      idempotency_key: `seed_inv_${sampleSubscriptions[1].id}`,
      line_items: [
        { description: 'Enterprise Annual Subscription', amount: 10000.00 },
        { description: 'Annual Discount', amount: -500.00 },
        { description: 'GST (18%)', amount: 1710.00 }
      ],
      created_at: past30Str
    }
  ];

  if (isSupabaseConfigured) {
    console.log('Seeding Supabase tables directly...');
    await supabase.from('products').upsert(sampleProducts);
    await supabase.from('plans').upsert(samplePlans);
    await supabase.from('customers').upsert(sampleCustomers);
    await supabase.from('subscriptions').upsert(sampleSubscriptions);
    await supabase.from('invoices').upsert(sampleInvoices);
  } else {
    console.log('Populating in-memory test store...');
    memoryStore.products = sampleProducts;
    memoryStore.plans = samplePlans;
    memoryStore.customers = sampleCustomers;
    memoryStore.subscriptions = sampleSubscriptions;
    memoryStore.invoices = sampleInvoices;
  }

  console.log('🎉 Database seeding complete!');
  console.log(`- ${sampleCustomers.length} Customers`);
  console.log(`- ${samplePlans.length} Plans`);
  console.log(`- ${sampleSubscriptions.length} Subscriptions`);
  console.log(`- ${sampleInvoices.length} Invoices`);
}

if (require.main === module) {
  seed();
}

module.exports = seed;
