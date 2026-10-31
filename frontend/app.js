const API_BASE = '/api';

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    const data = await res.json();
    document.getElementById('virtualDateBadge').textContent = data.simulated_date || 'Today';
    document.getElementById('statRevenue').textContent = `₹${Number(data.stats.total_revenue).toLocaleString()}`;
    document.getElementById('statMRR').textContent = `₹${Number(data.stats.monthly_recurring_revenue).toLocaleString()}`;
    document.getElementById('statActiveSubs').textContent = data.stats.active_subscriptions;
    document.getElementById('statOverdue').textContent = `₹${Number(data.stats.overdue_amount).toLocaleString()}`;
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function fetchSubscriptions() {
  try {
    const res = await fetch(`${API_BASE}/subscriptions`);
    const subs = await res.json();
    const tbody = document.getElementById('subscriptionsTable');
    if (!subs.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">No active subscriptions yet.</td></tr>';
      return;
    }
    tbody.innerHTML = subs.map(s => {
      const custName = s.customers ? s.customers.name : (s.customer ? s.customer.name : 'Customer');
      const planName = s.plans ? s.plans.name : (s.plan ? s.plan.name : 'Plan');
      const price = s.plans ? s.plans.base_price : (s.plan ? s.plan.base_price : 0);
      return `
        <tr class="hover:bg-slate-700/30 transition-colors">
          <td class="py-3 px-3 font-medium text-white">${custName}</td>
          <td class="py-3 px-3 text-xs text-slate-300">${planName} (₹${price})</td>
          <td class="py-3 px-3 text-xs font-mono text-amber-300">${s.next_billing_date}</td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              ${s.status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching subscriptions:', err);
  }
}

async function fetchInvoices() {
  try {
    const res = await fetch(`${API_BASE}/billing/invoices`);
    const invoices = await res.json();
    const tbody = document.getElementById('invoicesTable');
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">No invoices yet. Click "Run Billing Run".</td></tr>';
      return;
    }
    tbody.innerHTML = invoices.map(inv => {
      const custName = inv.customers ? inv.customers.name : (inv.customer ? inv.customer.name : 'Customer');
      const isPaid = inv.status === 'paid';
      return `
        <tr class="hover:bg-slate-700/30 transition-colors">
          <td class="py-3 px-3 font-medium text-white">${custName}</td>
          <td class="py-3 px-3 font-mono font-bold text-white">₹${Number(inv.total_amount).toLocaleString()}</td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 text-xs rounded-full ${isPaid ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} font-semibold border">
              ${inv.status}
            </span>
          </td>
          <td class="py-3 px-3 text-right">
            ${isPaid 
              ? '<span class="text-xs text-slate-400"><i class="fa-solid fa-check text-emerald-400"></i> Completed</span>'
              : `<button onclick="recordPayment('${inv.id}')" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold px-2.5 py-1 rounded transition-all">
                  Pay Now
                 </button>`
            }
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error fetching invoices:', err);
  }
}

async function advanceTime(days = 30) {
  try {
    const res = await fetch(`${API_BASE}/time-machine/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    });
    const data = await res.json();
    await refreshAll();
  } catch (err) {
    console.error('Failed to advance time:', err);
  }
}

async function resetTime() {
  try {
    await fetch(`${API_BASE}/time-machine/reset`, { method: 'POST' });
    await refreshAll();
  } catch (err) {
    console.error('Failed to reset time:', err);
  }
}

async function runBilling() {
  try {
    const res = await fetch(`${API_BASE}/billing/run`, { method: 'POST' });
    const proof = await res.json();
    
    // Display Proof Banner
    const banner = document.getElementById('proofBanner');
    banner.classList.remove('hidden');
    
    const summary = document.getElementById('proofSummary');
    summary.innerHTML = `
      Evaluated <strong>${proof.summary.total_evaluated}</strong> subscriptions.
      Generated <span class="text-emerald-400 font-bold">${proof.summary.generated_count}</span> new invoices.
      Skipped <span class="text-amber-400 font-bold">${proof.summary.skipped_count}</span> duplicate items.
    `;

    const details = document.getElementById('proofDetails');
    let html = '';
    if (proof.generated_invoices.length) {
      html += '<div class="text-emerald-300 font-semibold mb-1">✅ Generated Invoices:</div>';
      proof.generated_invoices.forEach(i => {
        html += `<div class="bg-slate-900/60 p-2 rounded border border-slate-700/50 mb-1">+ Invoice for ${i.customer_name} (₹${i.total_amount}) | Idempotency Key: ${i.idempotency_key}</div>`;
      });
    }
    if (proof.skipped_proof.length) {
      html += '<div class="text-amber-300 font-semibold mt-2 mb-1">🛡️ Duplicate Proof (Idempotent Shield):</div>';
      proof.skipped_proof.forEach(s => {
        html += `<div class="bg-slate-900/60 p-2 rounded border border-slate-700/50 mb-1">BLOCKED duplicate for ${s.customer_name}: ${s.reason}</div>`;
      });
    }
    details.innerHTML = html;

    await refreshAll();
  } catch (err) {
    console.error('Error running billing:', err);
  }
}

async function recordPayment(invoiceId) {
  try {
    await fetch(`${API_BASE}/billing/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: 'UPI' })
    });
    await refreshAll();
  } catch (err) {
    console.error('Error recording payment:', err);
  }
}

async function openNewSubModal() {
  const custName = prompt("Enter customer name:", "Apex Enterprises");
  if (!custName) return;
  const email = `${custName.toLowerCase().replace(/\s+/g, '')}@example.com`;

  try {
    // 1. Create customer
    const cRes = await fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: custName, email })
    });
    const customer = await cRes.json();

    // 2. Get first plan
    const pRes = await fetch(`${API_BASE}/plans`);
    const plans = await pRes.json();
    const planId = plans.length ? plans[0].id : null;

    if (!planId) {
      alert("No plans found. Please seed the database first.");
      return;
    }

    // 3. Subscribe
    await fetch(`${API_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer.id, plan_id: planId })
    });

    await refreshAll();
  } catch (err) {
    console.error("Error creating subscription:", err);
  }
}

async function refreshAll() {
  await Promise.all([fetchStats(), fetchSubscriptions(), fetchInvoices()]);
}

// Initial load
refreshAll();
