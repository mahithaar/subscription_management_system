const express = require('express');
const router = express.Router();
const { supabase, isSupabaseConfigured, memoryStore } = require('../db');
const timeMachine = require('../timeMachine');
const crypto = require('crypto');

// 1. Get all invoices
router.get('/invoices', async (req, res) => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(name, email), subscriptions(plan_id)')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  const enriched = memoryStore.invoices.map(inv => ({
    ...inv,
    customer: memoryStore.customers.find(c => c.id === inv.customer_id)
  })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return res.json(enriched);
});

// 2. RUN BILLING WITH PROOF (Idempotent Batch Billing Run)
router.post('/run', async (req, res) => {
  const simulatedDate = await timeMachine.getCurrentDate();
  console.log(`[Billing Run] Executing batch billing as of simulated date: ${simulatedDate}`);

  let activeSubs = [];
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, plans(*), customers(*)')
      .eq('status', 'active')
      .lte('next_billing_date', simulatedDate);

    if (error) return res.status(500).json({ error: error.message });
    activeSubs = data || [];
  } else {
    activeSubs = memoryStore.subscriptions.filter(s => 
      s.status === 'active' && s.next_billing_date <= simulatedDate
    ).map(s => ({
      ...s,
      plan: memoryStore.plans.find(p => p.id === s.plan_id),
      customer: memoryStore.customers.find(c => c.id === s.customer_id)
    }));
  }

  const generatedInvoices = [];
  const skippedInvoices = [];

  for (const sub of activeSubs) {
    const idempotencyKey = `sub_${sub.id}_period_${sub.current_period_start}`;

    // CHECK IF INVOICE ALREADY EXISTS (Duplicate Prevention!)
    let alreadyBilled = false;
    if (isSupabaseConfigured) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existing) alreadyBilled = true;
    } else {
      alreadyBilled = memoryStore.invoices.some(inv => inv.idempotency_key === idempotencyKey);
    }

    if (alreadyBilled) {
      skippedInvoices.push({
        subscription_id: sub.id,
        customer_name: sub.customer ? sub.customer.name : 'Unknown',
        reason: `Duplicate blocked: Already billed for period starting ${sub.current_period_start}`,
        idempotency_key: idempotencyKey
      });
      continue;
    }

    // EXPLAINABLE INVOICE CALCULATION
    const basePrice = sub.plan ? Number(sub.plan.base_price) : 1000;
    const addOnAmount = 0.00;
    const discountAmount = basePrice > 5000 ? 500.00 : 0.00; // Sample discount rule
    const taxableSubtotal = basePrice + addOnAmount - discountAmount;
    const gstTax = Number((taxableSubtotal * 0.18).toFixed(2)); // 18% GST standard in India
    const totalAmount = Number((taxableSubtotal + gstTax).toFixed(2));

    const lineItems = [
      { description: `Base Subscription: ${sub.plan ? sub.plan.name : 'Software Plan'}`, amount: basePrice },
      { description: 'Add-ons / Usage', amount: addOnAmount },
      { description: 'Promotional Discount', amount: -discountAmount },
      { description: 'GST (18%)', amount: gstTax }
    ];

    const invoicePayload = {
      id: crypto.randomUUID(),
      subscription_id: sub.id,
      customer_id: sub.customer_id,
      billing_period_start: sub.current_period_start,
      billing_period_end: sub.current_period_end,
      base_price: basePrice,
      addon_amount: addOnAmount,
      discount_amount: discountAmount,
      tax_amount: gstTax,
      total_amount: totalAmount,
      status: 'pending',
      idempotency_key: idempotencyKey,
      line_items: lineItems,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      await supabase.from('invoices').insert([invoicePayload]);
      
      // Advance subscription billing period by 30 days
      const nextDate = new Date(sub.next_billing_date);
      nextDate.setDate(nextDate.getDate() + 30);
      const nextStr = nextDate.toISOString().split('T')[0];

      await supabase.from('subscriptions').update({
        current_period_start: sub.next_billing_date,
        current_period_end: nextStr,
        next_billing_date: nextStr
      }).eq('id', sub.id);
    } else {
      memoryStore.invoices.push(invoicePayload);

      // Advance subscription locally
      const nextDate = new Date(sub.next_billing_date);
      nextDate.setDate(nextDate.getDate() + 30);
      sub.current_period_start = sub.next_billing_date;
      sub.current_period_end = nextDate.toISOString().split('T')[0];
      sub.next_billing_date = nextDate.toISOString().split('T')[0];
    }

    generatedInvoices.push({
      invoice_id: invoicePayload.id,
      customer_name: sub.customer ? sub.customer.name : 'Unknown',
      total_amount: totalAmount,
      idempotency_key: idempotencyKey
    });
  }

  // RETURN PROOF REPORT
  return res.json({
    status: 'completed',
    simulated_date: simulatedDate,
    summary: {
      total_evaluated: activeSubs.length,
      generated_count: generatedInvoices.length,
      skipped_count: skippedInvoices.length
    },
    generated_invoices: generatedInvoices,
    skipped_proof: skippedInvoices
  });
});

// 3. Record Payment for an invoice
router.post('/invoices/:id/pay', async (req, res) => {
  const invoiceId = req.params.id;
  const { payment_method = 'UPI' } = req.body;

  if (isSupabaseConfigured) {
    const { data: inv, error: findErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
    if (findErr || !inv) return res.status(404).json({ error: 'Invoice not found' });

    await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
    const { data: pmt } = await supabase.from('payments').insert([{
      invoice_id: invoiceId,
      amount: inv.total_amount,
      payment_method,
      status: 'completed'
    }]).select().single();

    return res.json({ message: 'Payment recorded successfully', invoice_status: 'paid', payment: pmt });
  }

  const inv = memoryStore.invoices.find(i => i.id === invoiceId);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  inv.status = 'paid';
  const newPayment = {
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    amount: inv.total_amount,
    payment_method,
    payment_date: new Date().toISOString(),
    status: 'completed'
  };
  memoryStore.payments.push(newPayment);

  return res.json({ message: 'Payment recorded successfully', invoice_status: 'paid', payment: newPayment });
});

module.exports = router;
