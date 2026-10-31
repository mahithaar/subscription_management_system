/**
 * RecurOS Frontend Application Logic
 * Person 3 Deliverable: Billing & Invoicing Engine, Idempotency Proof, Explainable Invoices & Payments.
 */

let currentFilter = 'all';
let currentInvoiceForPayment = null;

document.addEventListener('DOMContentLoaded', () => {
  refreshAll();
});

async function refreshAll() {
  await Promise.all([
    loadStatus(),
    loadSubscriptions(),
    loadInvoices()
  ]);
}

// ----------------- SYSTEM STATUS & TIME MACHINE -----------------

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    document.getElementById('current-sim-date').innerText = data.simulated_date;
    document.getElementById('kpi-revenue').innerText = `₹${data.total_revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-due').innerText = `₹${data.total_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-invoices-count').innerText = data.total_invoices;
    document.getElementById('kpi-subscriptions-count').innerText = data.active_subscriptions;
    document.getElementById('kpi-overdue-text').innerText = `${data.overdue_invoices} overdue invoices`;
  } catch (err) {
    console.error('Error loading status:', err);
  }
}

async function advanceTime(payload) {
  try {
    const res = await fetch('/api/time-machine/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      await refreshAll();
    }
  } catch (err) {
    console.error('Error advancing time:', err);
  }
}

async function resetTime() {
  try {
    const res = await fetch('/api/time-machine/reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      await refreshAll();
    }
  } catch (err) {
    console.error('Error resetting time:', err);
  }
}

async function seedDemoData() {
  if (!confirm('Reset and re-seed clean Brightloop demo data?')) return;
  try {
    const res = await fetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    document.getElementById('proof-container').classList.add('hidden');
    await refreshAll();
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

// ----------------- SIGNATURE FEATURE: BILLING RUN & PROOF -----------------

async function previewBillingRun() {
  const btn = document.getElementById('btn-preview-run');
  btn.disabled = true;
  btn.innerText = 'Calculating Preview...';

  try {
    const res = await fetch('/api/billing/preview');
    const data = await res.json();
    renderProofBox(data, true);
  } catch (err) {
    console.error('Error previewing billing:', err);
  } finally {
    btn.disabled = false;
    btn.innerText = '🔍 Preview Billing Run (Dry Run)';
  }
}

async function executeBillingRun() {
  const btn = document.getElementById('btn-execute-run');
  btn.disabled = true;
  btn.innerText = 'Executing Run...';

  try {
    const res = await fetch('/api/billing/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    renderProofBox(data, false);
    await refreshAll();
  } catch (err) {
    console.error('Error executing billing run:', err);
  } finally {
    btn.disabled = false;
    btn.innerText = '⚡ Run Billing with Proof';
  }
}

function renderProofBox(data, isPreview = false) {
  const container = document.getElementById('proof-container');
  container.classList.remove('hidden');

  const totalExamined = data.total_examined || 0;
  const genCount = isPreview ? (data.will_generate || 0) : (data.invoices_generated || 0);
  const skipCount = isPreview ? (data.will_skip || 0) : (data.subscriptions_skipped || 0);
  const totalAmount = isPreview ? (data.total_estimated_amount || 0) : (data.total_amount_invoiced || 0);

  document.getElementById('proof-examined').innerText = totalExamined;
  document.getElementById('proof-generated').innerText = genCount;
  document.getElementById('proof-skipped').innerText = skipCount;
  document.getElementById('proof-amount').innerText = `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const tbody = document.getElementById('proof-log-tbody');
  tbody.innerHTML = '';

  const items = isPreview ? data.items : data.proof_logs;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No subscriptions examined.</td></tr>`;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    const isGen = (item.action === 'GENERATED' || item.action === 'GENERATE');
    let badgeClass = 'badge-emerald';
    let badgeText = isPreview ? 'WILL BILL' : 'GENERATED';

    if (!isGen) {
      if (item.reason.includes('Duplicate')) {
        badgeClass = 'badge-amber';
        badgeText = 'DUPLICATE BLOCKED';
      } else if (item.reason.includes('Inactive') || item.reason.includes('Draft')) {
        badgeClass = 'badge-gray';
        badgeText = 'SKIPPED (INACTIVE)';
      } else if (item.reason.includes('future')) {
        badgeClass = 'badge-cyan';
        badgeText = 'SKIPPED (NOT DUE)';
      } else {
        badgeClass = 'badge-rose';
        badgeText = 'SKIPPED';
      }
    }

    const amt = item.amount || item.estimated_amount || 0;
    const invNum = item.invoice_number || '—';

    tr.innerHTML = `
      <td><span class="font-mono font-bold">${item.subscription_id}</span></td>
      <td>${item.customer_name}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      <td class="font-mono text-cyan">${invNum}</td>
      <td class="font-mono font-bold">${amt > 0 ? '₹' + amt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</td>
      <td class="text-muted" style="max-width: 320px;">${item.reason}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------- INVOICES & PAYMENT LIFECYCLE -----------------

async function loadInvoices() {
  try {
    const url = currentFilter === 'all' ? '/api/invoices' : `/api/invoices?status=${encodeURIComponent(currentFilter)}`;
    const res = await fetch(url);
    const data = await res.json();
    renderInvoicesTable(data.invoices || []);
  } catch (err) {
    console.error('Error loading invoices:', err);
  }
}

function filterInvoices(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
  });
  loadInvoices();
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-tbody');
  tbody.innerHTML = '';

  if (invoices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No invoices matching current filter.</td></tr>`;
    return;
  }

  invoices.forEach(inv => {
    const tr = document.createElement('tr');

    let badgeClass = 'badge-gray';
    if (inv.status === 'Paid') badgeClass = 'badge-emerald';
    else if (inv.status === 'Partially Paid') badgeClass = 'badge-cyan';
    else if (inv.status === 'Confirmed') badgeClass = 'badge-indigo';
    else if (inv.status === 'Draft') badgeClass = 'badge-gray';
    else if (inv.status === 'Overdue') badgeClass = 'badge-rose';

    tr.innerHTML = `
      <td><strong class="font-mono text-cyan">${inv.invoice_number}</strong></td>
      <td>
        <div class="font-bold">${inv.customer_name}</div>
        <div class="text-dim" style="font-size: 11px;">${inv.customer_email}</div>
      </td>
      <td>
        <span class="font-mono">${inv.subscription_id}</span>
        <div class="text-dim" style="font-size: 11px;">${inv.plan_name}</div>
      </td>
      <td class="font-mono" style="font-size: 12px;">${inv.period_start} <br>to ${inv.period_end}</td>
      <td class="font-mono font-bold">₹${inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td class="font-mono ${inv.amount_due > 0 ? 'text-amber font-bold' : 'text-emerald'}">
        ₹${inv.amount_due.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
      <td><span class="badge ${badgeClass}">${inv.status}</span></td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline" onclick="openBreakdownModal('${inv.id}')">Breakdown</button>
        ${inv.status !== 'Paid' && inv.status !== 'Cancelled' ? `
          <button class="btn btn-sm btn-emerald" onclick="openPaymentModal('${inv.id}', '${inv.invoice_number}', ${inv.amount_due})">Pay</button>
        ` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------- EXPLAINABLE INVOICE BREAKDOWN MODAL -----------------

async function openBreakdownModal(invoiceId) {
  try {
    const res = await fetch(`/api/invoices/${invoiceId}`);
    const inv = await res.json();
    if (inv.error) return alert(inv.error);

    currentInvoiceForPayment = inv;

    document.getElementById('m-inv-title').innerText = `Invoice ${inv.invoice_number}`;
    document.getElementById('m-inv-customer').innerText = `${inv.customer_name} (${inv.customer_email})`;
    document.getElementById('m-inv-plan').innerText = `${inv.plan_name} (${inv.subscription_id})`;
    document.getElementById('m-inv-period').innerText = `${inv.period_start} to ${inv.period_end}`;

    const statusElem = document.getElementById('m-inv-status');
    statusElem.innerText = inv.status;
    statusElem.className = `badge ${inv.status === 'Paid' ? 'badge-emerald' : (inv.status === 'Partially Paid' ? 'badge-cyan' : 'badge-indigo')}`;

    // Render Line Items
    const linesTbody = document.getElementById('m-inv-lines');
    linesTbody.innerHTML = '';
    (inv.lines || []).forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${l.description}</td>
        <td>${l.quantity}</td>
        <td class="font-mono">₹${l.unit_price.toFixed(2)}</td>
        <td class="font-mono">${l.variant_extra_price > 0 ? '+ ₹' + l.variant_extra_price.toFixed(2) : '—'}</td>
        <td class="font-mono font-bold">₹${l.subtotal.toFixed(2)}</td>
      `;
      linesTbody.appendChild(tr);
    });

    // Render Explainable Calculation
    const b = inv.calculation_breakdown || {};
    document.getElementById('m-calc-base').innerText = `₹${(b.base_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('m-calc-variants').innerText = `+ ₹${(b.variants_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('m-calc-gross').innerText = `₹${(b.gross_subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const discLabel = b.discount_name ? `Discount (${b.discount_name})` : 'Discount Applied';
    document.getElementById('m-calc-discount-label').innerText = discLabel;
    document.getElementById('m-calc-discount').innerText = `- ₹${(b.discount_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    document.getElementById('m-calc-taxable').innerText = `₹${(b.taxable_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const taxLabel = b.tax_name ? `Tax (${b.tax_name})` : 'Tax (18% GST)';
    document.getElementById('m-calc-tax-label').innerText = taxLabel;
    document.getElementById('m-calc-tax').innerText = `+ ₹${(b.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    document.getElementById('m-calc-total').innerText = `₹${(inv.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('m-calc-paid').innerText = `₹${(inv.amount_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('m-calc-due').innerText = `₹${(inv.amount_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    // Render Payments History
    const payTbody = document.getElementById('m-inv-payments');
    payTbody.innerHTML = '';
    if (!inv.payments || inv.payments.length === 0) {
      payTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-2">No payments recorded yet.</td></tr>`;
    } else {
      inv.payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="font-mono text-cyan">${p.id}</td>
          <td>${p.payment_date}</td>
          <td><span class="badge badge-indigo">${p.payment_method}</span></td>
          <td class="font-mono text-dim">${p.reference_no || '—'}</td>
          <td class="font-mono font-bold text-emerald">₹${p.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        `;
        payTbody.appendChild(tr);
      });
    }

    // Toggle Pay button in modal footer
    const payBtn = document.getElementById('m-btn-record-payment');
    if (inv.status === 'Paid' || inv.status === 'Cancelled') {
      payBtn.classList.add('hidden');
    } else {
      payBtn.classList.remove('hidden');
    }

    document.getElementById('breakdown-modal').classList.remove('hidden');
  } catch (err) {
    console.error('Error loading breakdown:', err);
  }
}

function closeBreakdownModal() {
  document.getElementById('breakdown-modal').classList.add('hidden');
  currentInvoiceForPayment = null;
}

function openPaymentFromModal() {
  if (!currentInvoiceForPayment) return;
  const inv = currentInvoiceForPayment;
  closeBreakdownModal();
  openPaymentModal(inv.id, inv.invoice_number, inv.amount_due);
}

// ----------------- PAYMENT RECORDING MODAL -----------------

function openPaymentModal(invoiceId, invoiceNumber, amountDue) {
  document.getElementById('p-invoice-id').value = invoiceId;
  document.getElementById('p-invoice-num').innerText = invoiceNumber;
  document.getElementById('p-invoice-due').innerText = `₹${amountDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  document.getElementById('p-amount').value = amountDue.toFixed(2);
  document.getElementById('p-ref').value = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
  document.getElementById('p-notes').value = '';
  document.getElementById('payment-modal').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.add('hidden');
}

async function submitPayment(e) {
  e.preventDefault();
  const invoiceId = document.getElementById('p-invoice-id').value;
  const amount = parseFloat(document.getElementById('p-amount').value);
  const method = document.getElementById('p-method').value;
  const ref = document.getElementById('p-ref').value;
  const notes = document.getElementById('p-notes').value;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount,
        payment_method: method,
        reference_no: ref,
        notes: notes
      })
    });
    const data = await res.json();
    if (!data.success) {
      return alert(data.error || 'Payment failed');
    }

    alert(data.message);
    closePaymentModal();
    await refreshAll();
  } catch (err) {
    console.error('Error submitting payment:', err);
  }
}

// ----------------- SUBSCRIPTIONS QUICK VIEW -----------------

async function loadSubscriptions() {
  try {
    const res = await fetch('/api/subscriptions');
    const data = await res.json();
    renderSubscriptionsTable(data.subscriptions || []);

    const dueCount = (data.subscriptions || []).filter(s => s.is_due).length;
    document.getElementById('subs-due-badge').innerText = `${dueCount} Due for Billing`;
  } catch (err) {
    console.error('Error loading subscriptions:', err);
  }
}

function renderSubscriptionsTable(subs) {
  const tbody = document.getElementById('subscriptions-tbody');
  tbody.innerHTML = '';

  if (subs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No subscriptions registered.</td></tr>`;
    return;
  }

  subs.forEach(s => {
    const tr = document.createElement('tr');
    const badgeClass = s.status === 'Active' ? 'badge-emerald' : (s.status === 'Draft' ? 'badge-gray' : 'badge-amber');

    tr.innerHTML = `
      <td><span class="font-mono font-bold">${s.id}</span></td>
      <td>
        <div class="font-bold">${s.customer_name}</div>
        <div class="text-dim" style="font-size: 11px;">${s.customer_email}</div>
      </td>
      <td>
        <div>${s.plan_name}</div>
        <div class="text-dim font-mono" style="font-size: 11px;">₹${s.plan_price.toFixed(2)}</div>
      </td>
      <td><span class="badge badge-indigo">${s.billing_interval}</span></td>
      <td><span class="badge ${badgeClass}">${s.status}</span></td>
      <td class="font-mono ${s.is_due ? 'text-amber font-bold' : ''}">
        ${s.next_billing_date} ${s.is_due ? '⚡ DUE' : ''}
      </td>
      <td class="text-right">
        ${s.status === 'Active' ? `
          <button class="btn btn-sm btn-outline-cyan" onclick="billSingleSub('${s.id}')">Bill Now</button>
        ` : `<span class="text-dim" style="font-size: 11px;">Not Billable</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function billSingleSub(subId) {
  try {
    const res = await fetch(`/api/subscriptions/${subId}/bill-now`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      alert(`Billing Skipped / Error: ${data.error}`);
    } else {
      alert(`Success: ${data.message}`);
    }
    await refreshAll();
  } catch (err) {
    console.error('Error billing subscription:', err);
  }
}
