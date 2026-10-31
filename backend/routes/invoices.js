const express = require('express');
const router = express.Router();
const { memoryStore } = require('../db');
const timeMachine = require('../timeMachine');

// 1. Get all invoices with status filters (PAID, PENDING, FAILED) & summary
router.get('/', (req, res) => {
  const { status, search } = req.query;

  let invs = [...memoryStore.invoices];

  if (status && status.toUpperCase() !== 'ALL') {
    const s = status.toLowerCase();
    invs = invs.filter(inv => inv.status && inv.status.toLowerCase() === s);
  }

  if (search && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    invs = invs.filter(inv => 
      (inv.id && inv.id.toLowerCase().includes(q)) ||
      (inv.customer && inv.customer.toLowerCase().includes(q)) ||
      (inv.company && inv.company.toLowerCase().includes(q))
    );
  }

  // Summary counts and totals
  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let totalFailed = 0;

  memoryStore.invoices.forEach(inv => {
    const amt = Number(inv.total_amount || (inv.subtotal ? inv.subtotal * 1.18 : 2358.82));
    totalInvoiced += amt;
    if (inv.status === 'Paid' || inv.status === 'paid') totalPaid += amt;
    else if (inv.status === 'Pending' || inv.status === 'pending') totalPending += amt;
    else if (inv.status === 'Failed' || inv.status === 'failed') totalFailed += amt;
  });

  return res.json({
    invoices: invs,
    summary: {
      totalInvoiced: `₹${Math.round(totalInvoiced).toLocaleString('en-IN')}`,
      totalPaid: `₹${Math.round(totalPaid).toLocaleString('en-IN')}`,
      totalPending: `₹${Math.round(totalPending).toLocaleString('en-IN')}`,
      totalFailed: `₹${Math.round(totalFailed).toLocaleString('en-IN')}`,
      count: invs.length,
      paidCount: memoryStore.invoices.filter(i => i.status === 'Paid').length,
      pendingCount: memoryStore.invoices.filter(i => i.status === 'Pending').length,
      failedCount: memoryStore.invoices.filter(i => i.status === 'Failed').length
    }
  });
});

// 2. Get single invoice with full line items & explainable breakdown
router.get('/:id', (req, res) => {
  const invoice = memoryStore.invoices.find(i => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  // Enrich with detailed explain trace and taxes
  const subtotal = invoice.subtotal || 1999;
  const taxRate = invoice.tax_rate || 18;
  const taxAmount = invoice.tax_amount || Math.round(subtotal * 0.18 * 100) / 100;
  const total = invoice.total_amount || Math.round((subtotal + taxAmount) * 100) / 100;

  const enrichedInvoice = {
    ...invoice,
    subtotal: `₹${subtotal.toLocaleString('en-IN')}`,
    taxRate: `${taxRate}% GST`,
    taxAmount: `₹${taxAmount.toLocaleString('en-IN')}`,
    total: `₹${total.toLocaleString('en-IN')}`,
    explain_trace: {
      planName: invoice.plan || 'Growth Team',
      basePlanRate: subtotal,
      currency: 'INR',
      taxesApplied: [
        { name: 'CGST', rate: '9%', amount: taxAmount / 2 },
        { name: 'SGST', rate: '9%', amount: taxAmount / 2 }
      ],
      totalPayable: total
    },
    line_items: invoice.line_items || [
      {
        description: `${invoice.plan || 'Growth Team'} - Recurring Subscription`,
        quantity: 1,
        unit_price: subtotal,
        tax_rate: 18,
        line_total: total
      }
    ]
  };

  return res.json(enrichedInvoice);
});

// 3. Mark invoice as paid (Interactive Pay trigger)
router.post('/:id/pay', async (req, res) => {
  const invoice = memoryStore.invoices.find(i => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (invoice.status === 'Cancelled') {
    return res.status(400).json({ error: 'Cannot pay a cancelled invoice.' });
  }

  const { payment_method = 'Credit Card (•••• 4242)', gateway = 'Razorpay', amount, note = 'Interactive Payment' } = req.body;

  const totalAmount = Number(invoice.total_amount || (invoice.subtotal ? invoice.subtotal * 1.18 : 2358.82));
  const currentPaid = Number(invoice.amount_paid || (invoice.status === 'Paid' ? totalAmount : 0));
  const outstanding = Math.max(0, totalAmount - currentPaid);

  if (outstanding <= 0 && invoice.status === 'Paid') {
    return res.json({
      success: true,
      message: `Invoice ${invoice.id} is already fully paid.`,
      invoice
    });
  }

  const payAmount = amount ? Number(amount) : outstanding;
  if (payAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }
  if (payAmount > outstanding + 0.01) {
    return res.status(400).json({
      error: `Payment amount (₹${payAmount}) exceeds outstanding due (₹${outstanding}). Overpayments are restricted.`
    });
  }

  const newPaid = Math.round((currentPaid + payAmount) * 100) / 100;
  const isFullyPaid = newPaid >= totalAmount - 0.01;

  invoice.amount_paid = newPaid;
  invoice.status = isFullyPaid ? 'Paid' : 'Partial';
  invoice.paid_date = await timeMachine.getCurrentDate();

  // Create payment record in payments audit log
  const newTxn = {
    id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
    invoiceId: invoice.id,
    invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    customer: invoice.customer,
    amount: `₹${payAmount.toLocaleString('en-IN')}`,
    numeric_amount: payAmount,
    method: payment_method,
    payment_method: payment_method.toLowerCase().includes('card') ? 'card' : 'upi',
    gateway: gateway,
    status: 'Successful',
    note: note,
    timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    created_at: new Date().toISOString(),
    refund_amount: 0
  };

  if (!memoryStore.payments) memoryStore.payments = [];
  memoryStore.payments.unshift(newTxn);

  console.log(`💰 [Invoices] Invoice ${invoice.id} paid (₹${payAmount}) via ${gateway}. Transaction: ${newTxn.id}`);
  return res.json({
    success: true,
    message: `Payment of ₹${payAmount} recorded for Invoice ${invoice.id}`,
    invoice,
    payment: newTxn
  });
});

// 4. Cancel invoice
router.post('/:id/cancel', (req, res) => {
  const invoice = memoryStore.invoices.find(i => i.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  if (invoice.status === 'Paid') {
    return res.status(400).json({ error: 'Paid invoices cannot be cancelled. Use refund instead.' });
  }

  invoice.status = 'Cancelled';
  return res.json({ success: true, invoice });
});

// 5. Printable HTML invoice for PDF Download trigger
router.get('/:id/html', (req, res) => {
  const invoice = memoryStore.invoices.find(i => i.id === req.params.id);
  if (!invoice) return res.status(404).send('Invoice not found');

  const subtotal = invoice.subtotal || 1999;
  const tax = invoice.tax_amount || Math.round(subtotal * 0.18);
  const total = invoice.total_amount || subtotal + tax;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice ${invoice.id} - RecurOS</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
        .invoice-card { max-width: 700px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: 800; color: #111217; }
        .logo span { color: #f97316; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: ${invoice.status === 'Paid' ? '#dcfce7' : '#fef3c7'}; color: ${invoice.status === 'Paid' ? '#15803d' : '#b45309'}; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; font-size: 14px; }
        .meta-label { color: #64748b; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th { text-align: left; padding: 12px; background: #f8fafc; font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .totals { margin-top: 24px; margin-left: auto; width: 280px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .totals-row.grand { font-size: 18px; font-weight: 700; border-top: 2px solid #e2e8f0; margin-top: 8px; padding-top: 10px; color: #0f172a; }
        .footer { margin-top: 36px; text-align: center; font-size: 12px; color: #94a3b8; }
        @media print { body { padding: 0; } .invoice-card { border: none; box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <div class="logo">Recur<span>OS</span></div>
          <div>
            <span class="badge">${invoice.status}</span>
          </div>
        </div>
        <div class="meta-grid">
          <div>
            <div class="meta-label">Billed To</div>
            <strong>${invoice.customer}</strong><br/>
            ${invoice.company || ''}<br/>
            GSTIN: 29ABCDE1234F1Z5
          </div>
          <div style="text-align: right;">
            <div class="meta-label">Invoice Details</div>
            <strong>${invoice.id}</strong><br/>
            Issued: ${invoice.date}<br/>
            Due: ${invoice.dueDate}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${invoice.plan || 'Recurring Plan'}</strong><br/><small style="color: #64748b;">Subscription Period Billing Cycle</small></td>
              <td style="text-align: center;">1</td>
              <td style="text-align: right;">₹${subtotal.toLocaleString('en-IN')}</td>
              <td style="text-align: right;">₹${subtotal.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal:</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
          <div class="totals-row"><span>GST (18%):</span><span>₹${tax.toLocaleString('en-IN')}</span></div>
          <div class="totals-row grand"><span>Total Payable:</span><span>₹${total.toLocaleString('en-IN')}</span></div>
        </div>
        <div class="footer">
          <p>Thank you for your business. RecurOS auditable billing system.</p>
        </div>
      </div>
      <script>
        if (window.location.search.includes('print=true')) {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

module.exports = router;
