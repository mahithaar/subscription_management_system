const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');

// 1. Get all payments (Live transaction audit log in PaymentsView.jsx)
router.get('/', (req, res) => {
  const { gateway, status, search } = req.query;

  let txns = [...memoryStore.payments];

  if (gateway && gateway.toUpperCase() !== 'ALL') {
    const gw = gateway.toLowerCase();
    txns = txns.filter(t => t.gateway && t.gateway.toLowerCase() === gw);
  }

  if (status && status.toUpperCase() !== 'ALL') {
    const s = status.toLowerCase();
    txns = txns.filter(t => t.status && t.status.toLowerCase() === s);
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    txns = txns.filter(t => 
      (t.id && t.id.toLowerCase().includes(q)) ||
      (t.customer && t.customer.toLowerCase().includes(q)) ||
      (t.invoiceId && t.invoiceId.toLowerCase().includes(q))
    );
  }

  // Calculate summary metrics
  let totalSuccessful = 0;
  let totalRefunded = 0;
  let successCount = 0;

  memoryStore.payments.forEach(p => {
    const val = Number(p.numeric_amount || p.amount.toString().replace(/[^0-9.]/g, '') || 0);
    if (p.status === 'Successful' || p.status === 'completed') {
      totalSuccessful += val;
      successCount++;
    } else if (p.status === 'Refunded') {
      totalRefunded += Number(p.refund_amount || val);
    }
  });

  const successRate = memoryStore.payments.length > 0 
    ? Math.round((successCount / memoryStore.payments.length) * 1000) / 10 
    : 95.2;

  return res.json({
    payments: txns,
    summary: {
      totalSuccessful: `₹${totalSuccessful.toLocaleString('en-IN')}`,
      totalRefunded: `₹${totalRefunded.toLocaleString('en-IN')}`,
      successRate: `${successRate}%`,
      totalTransactions: txns.length,
      connectedGateways: [
        { name: 'Razorpay', status: 'Connected', badge: 'Active', color: 'emerald' },
        { name: 'Stripe', status: 'Connected', badge: 'Active', color: 'emerald' },
        { name: 'Cashfree', status: 'Configured', badge: 'Sandbox', color: 'slate' }
      ]
    }
  });
});

// 2. Get payment by ID
router.get('/:id', (req, res) => {
  const payment = memoryStore.payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment record not found' });
  return res.json(payment);
});

// 3. Process refund (Refund tracking in PaymentsView.jsx)
router.post('/:id/refund', (req, res) => {
  const payment = memoryStore.payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment record not found' });

  const { reason = 'Customer request', amount } = req.body;
  const refundAmount = amount ? Number(amount) : Number(payment.numeric_amount || 1999);

  payment.status = 'Refunded';
  payment.refund_amount = refundAmount;
  payment.refund_reason = reason;
  payment.refunded_at = new Date().toISOString();

  // If tied to an invoice, update invoice state
  if (payment.invoiceId || payment.invoice_id) {
    const invId = payment.invoiceId || payment.invoice_id;
    const invoice = memoryStore.invoices.find(i => i.id === invId);
    if (invoice) {
      invoice.status = 'Refunded';
    }
  }

  console.log(`↩️ [Payments] Refund processed for ${payment.id}: ₹${refundAmount} (Reason: ${reason})`);
  return res.json({
    success: true,
    message: `Refund of ₹${refundAmount} processed successfully`,
    payment
  });
});

module.exports = router;
