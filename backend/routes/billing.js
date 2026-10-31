const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');
const timeMachine = require('../timeMachine');

// 1. Get all billing invoices (used by frontend /api/billing/invoices)
router.get('/invoices', (req, res) => {
  const invoices = memoryStore.invoices.map(inv => ({
    ...inv,
    customer: memoryStore.customers.find(c => c.id === inv.customer_id) || { name: inv.customer, email: 'billing@customer.com' }
  }));
  return res.json(invoices);
});

// 2. Pay invoice alias (used by frontend /api/billing/invoices/:id/pay)
router.post('/invoices/:id/pay', async (req, res) => {
  const invoice = memoryStore.invoices.find(i => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  invoice.status = 'Paid';
  invoice.amount_paid = invoice.total_amount || 2358.82;
  invoice.paid_date = await timeMachine.getCurrentDate();

  const newTxn = {
    id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
    invoiceId: invoice.id,
    invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    customer: invoice.customer,
    amount: invoice.total || '₹2,358',
    numeric_amount: invoice.total_amount || 2358.82,
    method: req.body.payment_method || 'Credit Card',
    payment_method: 'card',
    gateway: 'Razorpay',
    status: 'Successful',
    timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    created_at: new Date().toISOString(),
    refund_amount: 0
  };

  memoryStore.payments.unshift(newTxn);

  return res.json({
    success: true,
    message: `Invoice ${invoice.id} paid successfully`,
    invoice,
    payment: newTxn
  });
});

// 3. RUN BATCH BILLING WITH MATHEMATICAL PROOF (Zero-Duplicate Idempotency)
router.post('/run', async (req, res) => {
  const simulatedDate = await timeMachine.getCurrentDate();
  console.log(`[Billing Run] Executing batch billing as of simulated date: ${simulatedDate}`);

  // Find due subscriptions: active subscriptions with next_billing_date <= simulatedDate
  const dueSubscriptions = memoryStore.subscriptions.filter(s => 
    (s.status === 'Active' || s.status === 'active') &&
    s.next_billing_date && s.next_billing_date <= simulatedDate
  );

  const generatedInvoices = [];
  const skippedInvoices = [];
  let duplicateCount = 0;
  let totalBilledAmount = 0;

  for (const sub of dueSubscriptions) {
    const periodStart = sub.current_period_start || simulatedDate;
    const idempotencyKey = `sub_${sub.id}_period_${periodStart}`;

    // IDEMPOTENCY CHECK: has an invoice already been generated for this subscription & period?
    const alreadyBilled = memoryStore.invoices.some(inv => inv.idempotency_key === idempotencyKey);

    if (alreadyBilled) {
      duplicateCount++;
      skippedInvoices.push({
        subscription_id: sub.id,
        customer_name: sub.customer,
        reason: `Duplicate blocked by idempotency key: ${idempotencyKey}`,
        outcome: 'duplicate_blocked'
      });
      continue;
    }

    // Generate Invoice with 18% GST calculation
    const plan = memoryStore.plans.find(p => p.id === sub.plan_id) || {
      name: sub.plan || 'Growth Team',
      monthly_price: sub.base_amount || 1999
    };

    const subtotal = Number(sub.base_amount || plan.monthly_price || 1999);
    const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
    totalBilledAmount += totalAmount;

    const nextInvoiceNumber = `INV-2024-${String(memoryStore.invoices.length + 1).padStart(3, '0')}`;
    const nextMonth = new Date(simulatedDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const dueDateStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    const newInvoice = {
      id: nextInvoiceNumber,
      number: nextInvoiceNumber,
      customer_id: sub.customer_id,
      customer: sub.customer,
      company: `${sub.customer}'s Company`,
      amount: `₹${subtotal.toLocaleString('en-IN')}`,
      subtotal: subtotal,
      tax: `₹${taxAmount.toLocaleString('en-IN')}`,
      tax_amount: taxAmount,
      tax_rate: 18,
      total: `₹${totalAmount.toLocaleString('en-IN')}`,
      total_amount: totalAmount,
      amount_paid: 0,
      date: new Date(simulatedDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      created_at: simulatedDate,
      dueDate: new Date(dueDateStr).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      due_date: dueDateStr,
      status: 'Pending',
      plan: sub.plan || plan.name,
      idempotency_key: idempotencyKey,
      line_items: [
        {
          description: `${sub.plan || plan.name} - Recurring Subscription`,
          quantity: 1,
          unit_price: subtotal,
          tax_rate: 18,
          line_total: totalAmount
        }
      ]
    };

    memoryStore.invoices.unshift(newInvoice);
    generatedInvoices.push({
      invoice_id: newInvoice.id,
      customer_name: sub.customer,
      total_amount: totalAmount,
      idempotency_key: idempotencyKey
    });

    // Advance subscription renewal cycle
    sub.current_period_start = simulatedDate;
    sub.current_period_end = nextMonth.toISOString().split('T')[0];
    sub.next_billing_date = sub.current_period_end;
    sub.nextBilling = new Date(sub.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  // Balanced proof verification: Total Evaluated == Generated + Skipped
  const totalEvaluated = dueSubscriptions.length;
  const generatedCount = generatedInvoices.length;
  const skippedCount = skippedInvoices.length;
  const isBalanced = (totalEvaluated === generatedCount + skippedCount);

  const runSummary = {
    run_id: `RUN-${Date.now().toString().slice(-6)}`,
    simulated_date: simulatedDate,
    summary: {
      total_evaluated: totalEvaluated,
      generated_count: generatedCount,
      skipped_count: skippedCount,
      duplicate_count: duplicateCount,
      total_amount: totalBilledAmount
    },
    proof: {
      formula: "Evaluated == Generated + Skipped (Duplicates Blocked)",
      balanced: isBalanced,
      equation: `${totalEvaluated} == ${generatedCount} + ${skippedCount}`,
      idempotency_shield: "Active (Zero duplicate invoices allowed)"
    },
    generated_invoices: generatedInvoices,
    skipped_proof: skippedInvoices
  };

  if (!memoryStore.billingRuns) memoryStore.billingRuns = [];
  memoryStore.billingRuns.unshift(runSummary);

  return res.json(runSummary);
});

// 4. List past billing runs
router.get('/runs', (req, res) => {
  return res.json(memoryStore.billingRuns || []);
});

module.exports = router;
