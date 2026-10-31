const { supabase, isSupabaseConfigured, memoryStore } = require('./db');
const crypto = require('crypto');

async function seed() {
  console.log('🌱 Starting RecurOS Database Seeding (Faithful to Reference UI)...');

  // 1. PRODUCTS
  const sampleProducts = [
    { id: 'PROD-001', name: 'RecurOS Billing Platform', description: 'Core recurring billing and subscription automation platform' }
  ];

  // 2. PLANS (Matching mockPlans)
  const samplePlans = [
    {
      id: 'plan-starter',
      product_id: 'PROD-001',
      name: 'Starter Solo',
      description: 'Designed for solo founders, freelancers, and early projects testing the waters.',
      price: '₹799',
      base_price: 799.00,
      monthly_price: 799.00,
      yearly_price: 7670.00,
      currency: 'INR',
      period: 'per month',
      popular: false,
      activeSubscribers: 30,
      mrr: '₹23,970',
      features: [
        'Up to 50 subscribers',
        'Standard recurring invoices',
        'Stripe & Razorpay integrations',
        'Email notifications',
        'Community Discord support'
      ]
    },
    {
      id: 'plan-growth',
      product_id: 'PROD-001',
      name: 'Growth Team',
      description: 'Ideal for fast scaling SaaS startups with multiple team members and high volume.',
      price: '₹1,999',
      base_price: 1999.00,
      monthly_price: 1999.00,
      yearly_price: 19190.00,
      currency: 'INR',
      period: 'per month',
      popular: true,
      activeSubscribers: 42,
      mrr: '₹83,958',
      features: [
        'Up to 500 subscribers',
        'Automated dunning & retry logic',
        'Custom invoice branding',
        'Webhooks & REST APIs',
        'Priority 24/7 chat support',
        'Multi-currency support'
      ]
    },
    {
      id: 'plan-enterprise',
      product_id: 'PROD-001',
      name: 'Enterprise Pro',
      description: 'For established businesses needing dedicated infrastructure, SLA, and custom agreements.',
      price: '₹4,999',
      base_price: 4999.00,
      monthly_price: 4999.00,
      yearly_price: 47990.00,
      currency: 'INR',
      period: 'per month',
      popular: false,
      activeSubscribers: 54,
      mrr: '₹269,946',
      features: [
        'Unlimited active subscribers',
        'Custom billing cycles & contracts',
        'Dedicated account manager',
        '99.99% uptime guarantee',
        'SOC2 Type II compliance reports',
        'White-label customer billing portal'
      ]
    }
  ];

  // 3. CUSTOMERS (Detailed primary customers + background counts totaling 98 customers)
  const primaryCustomers = [
    {
      id: 'CUST-001',
      name: 'John Doe',
      email: 'john@techcorp.io',
      company: 'TechCorp Labs',
      plan: 'Enterprise Pro',
      status: 'Active',
      spent: '₹59,988',
      lifetime_spend: 59988,
      joinDate: 'Jan 14, 2024',
      avatar: 'JD',
      phone: '+91 98765 43210'
    },
    {
      id: 'CUST-002',
      name: 'Sarah Miller',
      email: 'sarah.m@designstudio.co',
      company: 'Studio Bloom',
      plan: 'Growth Team',
      status: 'Active',
      spent: '₹23,988',
      lifetime_spend: 23988,
      joinDate: 'Feb 03, 2024',
      avatar: 'SM',
      phone: '+91 98765 43211'
    },
    {
      id: 'CUST-003',
      name: 'Robert Lee',
      email: 'robert@apexsoft.dev',
      company: 'ApexSoft Systems',
      plan: 'Enterprise Pro',
      status: 'Active',
      spent: '₹74,990',
      lifetime_spend: 74990,
      joinDate: 'Nov 12, 2023',
      avatar: 'RL',
      phone: '+91 98765 43212'
    },
    {
      id: 'CUST-004',
      name: 'Emma Parker',
      email: 'emma@bloomcreative.net',
      company: 'Bloom Creative Agency',
      plan: 'Starter Solo',
      status: 'Trialing',
      spent: '₹799',
      lifetime_spend: 799,
      joinDate: 'Dec 20, 2024',
      avatar: 'EP',
      phone: '+91 98765 43213'
    },
    {
      id: 'CUST-005',
      name: 'Vikram Malhotra',
      email: 'vikram@zenithcloud.in',
      company: 'Zenith Cloud Services',
      plan: 'Enterprise Pro',
      status: 'Past Due',
      spent: '₹49,990',
      lifetime_spend: 49990,
      joinDate: 'Mar 19, 2024',
      avatar: 'VM',
      phone: '+91 98765 43214'
    },
    {
      id: 'CUST-006',
      name: 'Aanya Sharma',
      email: 'aanya@finflow.io',
      company: 'FinFlow Analytics',
      plan: 'Growth Team',
      status: 'Active',
      spent: '₹19,990',
      lifetime_spend: 19990,
      joinDate: 'Apr 02, 2024',
      avatar: 'AS',
      phone: '+91 98765 43215'
    },
    {
      id: 'CUST-007',
      name: 'David Kim',
      email: 'david@nexuslogic.com',
      company: 'Nexus Logic Corp',
      plan: 'Growth Team',
      status: 'Cancelled',
      spent: '₹11,994',
      lifetime_spend: 11994,
      joinDate: 'May 15, 2024',
      avatar: 'DK',
      phone: '+91 98765 43216'
    }
  ];

  // Generate additional customers to reach total of 98 customers as highlighted in dashboard
  const sampleCompanyNames = [
    'CloudMatrix', 'HyperScale Labs', 'KiteSecure', 'VibeMetrics', 'CognitiveSoft',
    'GreenPeak Systems', 'InnoWave', 'SwiftFin', 'OrbitalData', 'CoreStack',
    'PulseSync', 'BlueRidge AI', 'DeltaOps', 'ApexLogistics', 'NovaSpark'
  ];
  const sampleFirstNames = ['Anand', 'Pooja', 'Rohan', 'Sneha', 'Karthik', 'Meera', 'Arjun', 'Divya', 'Nikhil', 'Tanvi'];
  const sampleLastNames = ['Nair', 'Menon', 'Verma', 'Gupta', 'Iyer', 'Reddy', 'Patel', 'Das', 'Chopra', 'Sen'];

  const allCustomers = [...primaryCustomers];
  for (let i = 8; i <= 98; i++) {
    const fn = sampleFirstNames[(i - 1) % sampleFirstNames.length];
    const ln = sampleLastNames[(i - 1) % sampleLastNames.length];
    const comp = `${sampleCompanyNames[(i - 1) % sampleCompanyNames.length]} ${i % 3 === 0 ? 'Pvt Ltd' : 'Inc'}`;
    const status = i <= 65 ? 'Active' : (i <= 84 ? 'Trialing' : (i <= 94 ? 'Past Due' : 'Cancelled'));
    const plan = i % 3 === 0 ? 'Enterprise Pro' : (i % 2 === 0 ? 'Growth Team' : 'Starter Solo');

    allCustomers.push({
      id: `CUST-${String(i).padStart(3, '0')}`,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${comp.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      company: comp,
      plan: plan,
      status: status,
      spent: `₹${(Math.floor(i * 1450)).toLocaleString('en-IN')}`,
      lifetime_spend: i * 1450,
      joinDate: `Oct ${((i % 28) + 1)}, 2024`,
      avatar: `${fn[0]}${ln[0]}`,
      phone: `+91 98${String(10000000 + i).slice(0, 8)}`
    });
  }

  // 4. SUBSCRIPTIONS (Primary subscriptions + generated to reach 126 total active/historical)
  const primarySubscriptions = [
    {
      id: 'SUB-8901',
      customer_id: 'CUST-001',
      customer: 'John Doe',
      email: 'john@techcorp.io',
      plan_id: 'plan-enterprise',
      plan: 'Enterprise Pro',
      billingCycle: 'Monthly',
      billing_cycle: 'monthly',
      amount: '₹4,999',
      base_amount: 4999,
      status: 'Active',
      nextBilling: 'Jan 28, 2025',
      next_billing_date: '2025-01-28',
      current_period_start: '2024-12-28',
      current_period_end: '2025-01-28',
      paymentMethod: 'Visa ending in 4242'
    },
    {
      id: 'SUB-8902',
      customer_id: 'CUST-002',
      customer: 'Sarah Miller',
      email: 'sarah.m@designstudio.co',
      plan_id: 'plan-growth',
      plan: 'Growth Team',
      billingCycle: 'Monthly',
      billing_cycle: 'monthly',
      amount: '₹1,999',
      base_amount: 1999,
      status: 'Active',
      nextBilling: 'Jan 27, 2025',
      next_billing_date: '2025-01-27',
      current_period_start: '2024-12-27',
      current_period_end: '2025-01-27',
      paymentMethod: 'Mastercard ending in 8812'
    },
    {
      id: 'SUB-8903',
      customer_id: 'CUST-003',
      customer: 'Robert Lee',
      email: 'robert@apexsoft.dev',
      plan_id: 'plan-enterprise',
      plan: 'Enterprise Pro',
      billingCycle: 'Yearly',
      billing_cycle: 'yearly',
      amount: '₹49,990',
      base_amount: 49990,
      status: 'Active',
      nextBilling: 'Nov 12, 2025',
      next_billing_date: '2025-11-12',
      current_period_start: '2024-11-12',
      current_period_end: '2025-11-12',
      paymentMethod: 'Amex ending in 1009'
    },
    {
      id: 'SUB-8904',
      customer_id: 'CUST-004',
      customer: 'Emma Parker',
      email: 'emma@bloomcreative.net',
      plan_id: 'plan-starter',
      plan: 'Starter Solo',
      billingCycle: 'Monthly',
      billing_cycle: 'monthly',
      amount: '₹799',
      base_amount: 799,
      status: 'Trialing',
      nextBilling: 'Jan 05, 2025',
      next_billing_date: '2025-01-05',
      current_period_start: '2024-12-20',
      current_period_end: '2025-01-05',
      paymentMethod: 'UPI / GPay'
    },
    {
      id: 'SUB-8905',
      customer_id: 'CUST-005',
      customer: 'Vikram Malhotra',
      email: 'vikram@zenithcloud.in',
      plan_id: 'plan-enterprise',
      plan: 'Enterprise Pro',
      billingCycle: 'Monthly',
      billing_cycle: 'monthly',
      amount: '₹4,999',
      base_amount: 4999,
      status: 'Past Due',
      nextBilling: 'Dec 24, 2024',
      next_billing_date: '2024-12-24',
      current_period_start: '2024-11-24',
      current_period_end: '2024-12-24',
      paymentMethod: 'Visa ending in 3319'
    },
    {
      id: 'SUB-8906',
      customer_id: 'CUST-007',
      customer: 'David Kim',
      email: 'david@nexuslogic.com',
      plan_id: 'plan-growth',
      plan: 'Growth Team',
      billingCycle: 'Monthly',
      billing_cycle: 'monthly',
      amount: '₹1,999',
      base_amount: 1999,
      status: 'Cancelled',
      nextBilling: '—',
      next_billing_date: '2024-12-15',
      current_period_start: '2024-11-15',
      current_period_end: '2024-12-15',
      paymentMethod: 'Mastercard ending in 5541'
    }
  ];

  const allSubscriptions = [...primarySubscriptions];
  // Add generated subscriptions matching the 126 active subscriptions count
  for (let i = 7; i <= 140; i++) {
    const custIndex = (i % allCustomers.length);
    const cust = allCustomers[custIndex];
    const isAct = i <= 126;
    const planObj = samplePlans[i % 3];
    const isYearly = i % 5 === 0;

    allSubscriptions.push({
      id: `SUB-${8900 + i}`,
      customer_id: cust.id,
      customer: cust.name,
      email: cust.email,
      plan_id: planObj.id,
      plan: planObj.name,
      billingCycle: isYearly ? 'Yearly' : 'Monthly',
      billing_cycle: isYearly ? 'yearly' : 'monthly',
      amount: isYearly ? `₹${planObj.yearly_price.toLocaleString('en-IN')}` : `₹${planObj.monthly_price.toLocaleString('en-IN')}`,
      base_amount: isYearly ? planObj.yearly_price : planObj.monthly_price,
      status: isAct ? 'Active' : (i <= 134 ? 'Past Due' : 'Cancelled'),
      nextBilling: `Jan ${((i % 28) + 1)}, 2025`,
      next_billing_date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      current_period_start: `2024-12-${String((i % 28) + 1).padStart(2, '0')}`,
      current_period_end: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      paymentMethod: i % 2 === 0 ? 'Visa ending in 4242' : 'UPI / GPay'
    });
  }

  // 5. INVOICES (Matching mockInvoices + breakdown with 18% GST)
  const sampleInvoices = [
    {
      id: 'INV-2024-001',
      number: 'INV-2024-001',
      customer_id: 'CUST-001',
      customer: 'John Doe',
      company: 'TechCorp Labs',
      amount: '₹4,999',
      subtotal: 4999.00,
      tax: '₹899',
      tax_amount: 899.82,
      tax_rate: 18,
      total: '₹5,898',
      total_amount: 5898.82,
      amount_paid: 5898.82,
      date: 'Dec 28, 2024',
      created_at: '2024-12-28',
      dueDate: 'Jan 10, 2025',
      due_date: '2025-01-10',
      status: 'Paid',
      plan: 'Enterprise Pro',
      idempotency_key: 'sub_SUB-8901_period_2024-12-28',
      line_items: [
        { description: 'Enterprise Pro - Monthly Subscription', quantity: 1, unit_price: 4999, tax_rate: 18, line_total: 5898.82 }
      ]
    },
    {
      id: 'INV-2024-002',
      number: 'INV-2024-002',
      customer_id: 'CUST-002',
      customer: 'Sarah Miller',
      company: 'Studio Bloom',
      amount: '₹1,999',
      subtotal: 1999.00,
      tax: '₹359',
      tax_amount: 359.82,
      tax_rate: 18,
      total: '₹2,358',
      total_amount: 2358.82,
      amount_paid: 0,
      date: 'Dec 27, 2024',
      created_at: '2024-12-27',
      dueDate: 'Jan 09, 2025',
      due_date: '2025-01-09',
      status: 'Pending',
      plan: 'Growth Team',
      idempotency_key: 'sub_SUB-8902_period_2024-12-27',
      line_items: [
        { description: 'Growth Team - Monthly Subscription', quantity: 1, unit_price: 1999, tax_rate: 18, line_total: 2358.82 }
      ]
    },
    {
      id: 'INV-2024-003',
      number: 'INV-2024-003',
      customer_id: 'CUST-003',
      customer: 'Robert Lee',
      company: 'ApexSoft Systems',
      amount: '₹9,999',
      subtotal: 9999.00,
      tax: '₹1,799',
      tax_amount: 1799.82,
      tax_rate: 18,
      total: '₹11,798',
      total_amount: 11798.82,
      amount_paid: 11798.82,
      date: 'Dec 26, 2024',
      created_at: '2024-12-26',
      dueDate: 'Jan 08, 2025',
      due_date: '2025-01-08',
      status: 'Paid',
      plan: 'Dedicated Scale',
      idempotency_key: 'sub_SUB-8903_period_2024-11-12',
      line_items: [
        { description: 'Dedicated Scale - Custom Subscription', quantity: 1, unit_price: 9999, tax_rate: 18, line_total: 11798.82 }
      ]
    },
    {
      id: 'INV-2024-004',
      number: 'INV-2024-004',
      customer_id: 'CUST-004',
      customer: 'Emma Parker',
      company: 'Bloom Creative Agency',
      amount: '₹799',
      subtotal: 799.00,
      tax: '₹143',
      tax_amount: 143.82,
      tax_rate: 18,
      total: '₹942',
      total_amount: 942.82,
      amount_paid: 0,
      date: 'Dec 25, 2024',
      created_at: '2024-12-25',
      dueDate: 'Jan 07, 2025',
      due_date: '2025-01-07',
      status: 'Pending',
      plan: 'Starter Solo',
      idempotency_key: 'sub_SUB-8904_period_2024-12-20',
      line_items: [
        { description: 'Starter Solo - Monthly Subscription', quantity: 1, unit_price: 799, tax_rate: 18, line_total: 942.82 }
      ]
    },
    {
      id: 'INV-2024-005',
      number: 'INV-2024-005',
      customer_id: 'CUST-005',
      customer: 'Vikram Malhotra',
      company: 'Zenith Cloud Services',
      amount: '₹4,999',
      subtotal: 4999.00,
      tax: '₹899',
      tax_amount: 899.82,
      tax_rate: 18,
      total: '₹5,898',
      total_amount: 5898.82,
      amount_paid: 0,
      date: 'Dec 24, 2024',
      created_at: '2024-12-24',
      dueDate: 'Jan 06, 2025',
      due_date: '2025-01-06',
      status: 'Failed',
      plan: 'Enterprise Pro',
      idempotency_key: 'sub_SUB-8905_period_2024-11-24',
      line_items: [
        { description: 'Enterprise Pro - Monthly Subscription', quantity: 1, unit_price: 4999, tax_rate: 18, line_total: 5898.82 }
      ]
    },
    {
      id: 'INV-2024-006',
      number: 'INV-2024-006',
      customer_id: 'CUST-006',
      customer: 'Aanya Sharma',
      company: 'FinFlow Analytics',
      amount: '₹1,999',
      subtotal: 1999.00,
      tax: '₹359',
      tax_amount: 359.82,
      tax_rate: 18,
      total: '₹2,358',
      total_amount: 2358.82,
      amount_paid: 2358.82,
      date: 'Dec 22, 2024',
      created_at: '2024-12-22',
      dueDate: 'Jan 04, 2025',
      due_date: '2025-01-04',
      status: 'Paid',
      plan: 'Growth Team',
      idempotency_key: 'sub_SUB-8906_period_2024-12-22',
      line_items: [
        { description: 'Growth Team - Monthly Subscription', quantity: 1, unit_price: 1999, tax_rate: 18, line_total: 2358.82 }
      ]
    }
  ];

  // Add 16 more pending invoices to hit the exact 18 pending invoices metric
  for (let k = 7; k <= 22; k++) {
    const cust = allCustomers[k];
    sampleInvoices.push({
      id: `INV-2024-0${String(k).padStart(2, '0')}`,
      number: `INV-2024-0${String(k).padStart(2, '0')}`,
      customer_id: cust.id,
      customer: cust.name,
      company: cust.company,
      amount: '₹1,999',
      subtotal: 1999.00,
      tax: '₹359',
      tax_amount: 359.82,
      tax_rate: 18,
      total: '₹2,358',
      total_amount: 2358.82,
      amount_paid: 0,
      date: 'Dec 20, 2024',
      created_at: '2024-12-20',
      dueDate: 'Jan 03, 2025',
      due_date: '2025-01-03',
      status: 'Pending',
      plan: 'Growth Team',
      idempotency_key: `sub_SUB-${8900 + k}_period_2024-12-20`,
      line_items: [
        { description: 'Growth Team - Monthly Subscription', quantity: 1, unit_price: 1999, tax_rate: 18, line_total: 2358.82 }
      ]
    });
  }

  // 6. PAYMENTS (Live transaction audit log matching mockPayments)
  const samplePayments = [
    {
      id: 'TXN-77218',
      invoiceId: 'INV-2024-001',
      invoice_id: 'INV-2024-001',
      customer_id: 'CUST-001',
      customer: 'John Doe',
      amount: '₹5,898',
      numeric_amount: 5898.00,
      method: 'Credit Card (•••• 4242)',
      payment_method: 'card',
      gateway: 'Razorpay',
      status: 'Successful',
      timestamp: '28 Dec 2024, 14:32',
      created_at: '2024-12-28T14:32:00Z',
      refund_amount: 0
    },
    {
      id: 'TXN-77217',
      invoiceId: 'INV-2024-003',
      invoice_id: 'INV-2024-003',
      customer_id: 'CUST-003',
      customer: 'Robert Lee',
      amount: '₹11,798',
      numeric_amount: 11798.00,
      method: 'Amex (•••• 1009)',
      payment_method: 'amex',
      gateway: 'Stripe',
      status: 'Successful',
      timestamp: '26 Dec 2024, 09:14',
      created_at: '2024-12-26T09:14:00Z',
      refund_amount: 0
    },
    {
      id: 'TXN-77216',
      invoiceId: 'INV-2024-005',
      invoice_id: 'INV-2024-005',
      customer_id: 'CUST-005',
      customer: 'Vikram Malhotra',
      amount: '₹5,898',
      numeric_amount: 5898.00,
      method: 'Credit Card (•••• 3319)',
      payment_method: 'card',
      gateway: 'Razorpay',
      status: 'Failed',
      timestamp: '24 Dec 2024, 19:45',
      created_at: '2024-12-24T19:45:00Z',
      refund_amount: 0
    },
    {
      id: 'TXN-77215',
      invoiceId: 'INV-2024-006',
      invoice_id: 'INV-2024-006',
      customer_id: 'CUST-006',
      customer: 'Aanya Sharma',
      amount: '₹2,358',
      numeric_amount: 2358.00,
      method: 'UPI (aanya@okaxis)',
      payment_method: 'upi',
      gateway: 'Razorpay',
      status: 'Successful',
      timestamp: '22 Dec 2024, 11:05',
      created_at: '2024-12-22T11:05:00Z',
      refund_amount: 0
    },
    {
      id: 'TXN-77214',
      invoiceId: 'INV-2024-000',
      invoice_id: 'INV-2024-000',
      customer_id: 'CUST-002',
      customer: 'Rajesh Koothrappali',
      amount: '₹1,999',
      numeric_amount: 1999.00,
      method: 'Net Banking (HDFC)',
      payment_method: 'netbanking',
      gateway: 'Cashfree',
      status: 'Refunded',
      timestamp: '18 Dec 2024, 16:20',
      created_at: '2024-12-18T16:20:00Z',
      refund_amount: 1999.00,
      refund_reason: 'Accidental double charge'
    }
  ];

  // Store in memoryStore
  memoryStore.products = sampleProducts;
  memoryStore.plans = samplePlans;
  memoryStore.customers = allCustomers;
  memoryStore.subscriptions = allSubscriptions;
  memoryStore.invoices = sampleInvoices;
  memoryStore.payments = samplePayments;

  console.log(`✅ Seeded ${samplePlans.length} Plans`);
  console.log(`✅ Seeded ${allCustomers.length} Customers (Hero Metric: 98 Customers)`);
  console.log(`✅ Seeded ${allSubscriptions.length} Subscriptions (Hero Metric: 126 Active Subscriptions)`);
  console.log(`✅ Seeded ${sampleInvoices.length} Invoices (Hero Metric: 18 Pending Invoices, MRR ₹84,300)`);
  console.log(`✅ Seeded ${samplePayments.length} Transactions with Razorpay / Stripe integrations`);
  console.log('🚀 RecurOS Zero-Config Backend Seed complete!');
}

module.exports = seed;

// If executed directly:
if (require.main === module) {
  seed().then(() => {
    console.log('Done.');
    process.exit(0);
  });
}
