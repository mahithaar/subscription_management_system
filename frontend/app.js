// RecurOS Frontend Client - Integrated with FastAPI Backend
const API_BASE = window.location.origin.includes('8000') 
  ? '/api/v1' 
  : 'http://127.0.0.1:8000/api/v1';

let authToken = sessionStorage.getItem('recuros_token') || null;

async function getAuthHeaders() {
  if (!authToken) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@brightloop.io', password: 'Password123!' })
      });
      if (res.ok) {
        const data = await res.json();
        authToken = data.access_token;
        sessionStorage.setItem('recuros_token', authToken);
      }
    } catch (e) {
      console.warn('Auto-login error:', e);
    }
  }
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };
}

async function fetchStats() {
  try {
    const headers = await getAuthHeaders();
    
    // Fetch clock date
    const clockRes = await fetch(`${API_BASE}/clock`, { headers });
    if (clockRes.ok) {
      const clockData = await clockRes.json();
      const badge = document.getElementById('virtualDateBadge');
      badge.textContent = clockData.today || 'Today';
      if (clockData.is_simulated) {
        badge.classList.remove('bg-amber-400/20', 'text-amber-300', 'border-amber-400/40');
        badge.classList.add('bg-purple-500/20', 'text-purple-300', 'border-purple-400/40');
      }
    }

    // Fetch metrics
    const metricsRes = await fetch(`${API_BASE}/dashboard/metrics`, { headers });
    if (metricsRes.ok) {
      const data = await metricsRes.json();
      const kpis = data.kpis;
      document.getElementById('statRevenue').textContent = `₹${Number(kpis.collected_revenue || kpis.billed_revenue || 0).toLocaleString()}`;
      document.getElementById('statMRR').textContent = `₹${Number(kpis.mrr || 0).toLocaleString()}`;
      document.getElementById('statActiveSubs').textContent = kpis.active_subscriptions || 0;
      document.getElementById('statOverdue').textContent = `₹${Number(kpis.overdue_amount || 0).toLocaleString()}`;
    }
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function fetchSubscriptions() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/subscriptions`, { headers });
    if (!res.ok) return;
    const subs = await res.json();
    const tbody = document.getElementById('subscriptionsTable');
    if (!subs.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">No active subscriptions yet.</td></tr>';
      return;
    }
    tbody.innerHTML = subs.map(s => {
      const custName = s.customer_name || 'Customer';
      const planName = s.plan_name || 'Plan';
      const nextDue = s.next_invoice_date || s.next_billing_date || s.start_date || 'Due Today';
      const state = s.state || s.status || 'active';
      return `
        <tr class="hover:bg-slate-700/30 transition-colors">
          <td class="py-3 px-3 font-medium text-white">${custName}</td>
          <td class="py-3 px-3 text-xs text-slate-300">${planName}</td>
          <td class="py-3 px-3 text-xs font-mono text-amber-300">${nextDue}</td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              ${state}
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
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/invoices`, { headers });
    if (!res.ok) return;
    const invoices = await res.json();
    const tbody = document.getElementById('invoicesTable');
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">No invoices yet. Click "Run Billing Run".</td></tr>';
      return;
    }
    tbody.innerHTML = invoices.map(inv => {
      const custName = inv.customer_name || 'Customer';
      const isPaid = (inv.state === 'paid' || inv.status === 'paid');
      const total = inv.total || inv.total_amount || 0;
      const invNum = inv.number || `INV-${inv.id}`;
      return `
        <tr class="hover:bg-slate-700/30 transition-colors">
          <td class="py-3 px-3">
            <div class="font-medium text-white">${custName}</div>
            <div class="text-[11px] text-slate-400 font-mono">${invNum}</div>
          </td>
          <td class="py-3 px-3 font-mono font-bold text-white">₹${Number(total).toLocaleString()}</td>
          <td class="py-3 px-3">
            <span class="px-2 py-0.5 text-xs rounded-full ${isPaid ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'} font-semibold border">
              ${inv.state || inv.status}
            </span>
          </td>
          <td class="py-3 px-3 text-right">
            ${isPaid 
              ? '<span class="text-xs text-slate-400"><i class="fa-solid fa-check text-emerald-400"></i> Paid</span>'
              : `<button onclick="recordPayment(${inv.id}, ${total})" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold px-2.5 py-1 rounded transition-all">
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
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/clock/advance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ days })
    });
    await refreshAll();
  } catch (err) {
    console.error('Failed to advance time:', err);
  }
}

async function resetTime() {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/clock/reset`, { method: 'POST', headers });
    await refreshAll();
  } catch (err) {
    console.error('Failed to reset time:', err);
  }
}

async function runBilling() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/billing/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'execute' })
    });
    const data = await res.json();
    
    // Display Proof Banner
    const banner = document.getElementById('proofBanner');
    banner.classList.remove('hidden');
    
    const summary = document.getElementById('proofSummary');
    const proof = data.proof_panel || data.summary || {};
    
    const dueCount = proof.due_count !== undefined ? proof.due_count : (data.summary ? data.summary.total_evaluated : 0);
    const invoicedCount = proof.invoiced_count !== undefined ? proof.invoiced_count : (data.summary ? data.summary.generated_count : 0);
    const blockedCount = proof.duplicate_blocked_count !== undefined ? proof.duplicate_blocked_count : (data.summary ? data.summary.skipped_count : 0);
    const mathProof = proof.mathematical_proof || 'Due == Invoiced + Blocked';

    summary.innerHTML = `
      Evaluated <strong>${dueCount}</strong> subscriptions.
      Generated <span class="text-emerald-400 font-bold">${invoicedCount}</span> invoices.
      Blocked <span class="text-amber-400 font-bold">${blockedCount}</span> duplicate items.
      <br><span class="text-xs text-slate-400 font-mono mt-1 inline-block">Proof: ${mathProof}</span>
    `;

    const details = document.getElementById('proofDetails');
    let html = '';
    const items = data.items || [];
    if (items.length) {
      items.forEach(item => {
        if (item.outcome === 'created') {
          html += `<div class="bg-slate-900/60 p-2 rounded border border-emerald-500/30 mb-1 text-emerald-300">✅ ${item.subscription_number || 'Sub'}: ${item.reason} (₹${item.total})</div>`;
        } else {
          html += `<div class="bg-slate-900/60 p-2 rounded border border-amber-500/30 mb-1 text-amber-300">🛡️ ${item.subscription_number || 'Sub'}: ${item.reason}</div>`;
        }
      });
    } else {
      html = '<div class="text-slate-400">No subscriptions were due for billing as of current simulated date.</div>';
    }
    details.innerHTML = html;

    await refreshAll();
  } catch (err) {
    console.error('Error running billing:', err);
  }
}

async function recordPayment(invoiceId, amount) {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invoice_id: invoiceId,
        amount: amount,
        method: 'UPI'
      })
    });
    await refreshAll();
  } catch (err) {
    console.error('Error recording payment:', err);
  }
}

async function openNewSubModal() {
  const custName = prompt("Enter customer name:", "Apex Labs");
  if (!custName) return;
  alert("In this full blueprint version, subscriptions are created via quotation templates or the catalog API. Sample subscriptions are already loaded!");
}

async function refreshAll() {
  await Promise.all([fetchStats(), fetchSubscriptions(), fetchInvoices()]);
}

// Initial load
refreshAll();
