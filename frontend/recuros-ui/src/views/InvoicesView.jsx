import React, { useState } from 'react';
import { FileText, CheckCircle2, Clock, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { mockInvoices } from '../data/mockData';

export default function InvoicesView({ onNavigate, refreshTrigger = 0 }) {
  const [filter, setFilter] = useState('ALL');
  const [invoices, setInvoices] = useState(mockInvoices);

  const handlePay = (id) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'Paid' } : inv));
    alert(`Invoice ${id} marked as Paid via gateway transaction!`);
  };

  const filtered = invoices.filter(inv => {
    if (filter === 'ALL') return true;
    return inv.status.toUpperCase() === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Billing & Invoices</h1>
          <p className="text-sm text-slate-400">Automated recurring invoice ledger with 18% GST calculation and tax breakdown.</p>
        </div>
        <div className="flex items-center gap-2">
          {['ALL', 'PAID', 'PENDING', 'FAILED'].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === t ? 'bg-orange-500 text-white' : 'bg-[#14161d] text-slate-400 hover:text-white border border-[#232733]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#14161d] rounded-2xl border border-[#232733] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#1e222d] uppercase tracking-wider font-semibold bg-[#111217]/50">
                <th className="py-3.5 px-5">Invoice #</th>
                <th className="py-3.5 px-4">Customer & Company</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Subtotal</th>
                <th className="py-3.5 px-4">GST (18%)</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e222d]">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-orange-400">{inv.id}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{inv.customer}</div>
                    <div className="text-[11px] text-slate-400">{inv.company}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 font-medium">{inv.plan}</td>
                  <td className="py-3.5 px-4 text-slate-400">{inv.amount}</td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono">{inv.tax}</td>
                  <td className="py-3.5 px-4 font-extrabold text-white">{inv.total}</td>
                  <td className="py-3.5 px-4 text-slate-400">{inv.dueDate}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      inv.status === 'Paid' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      inv.status === 'Pending' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                      'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right space-x-2">
                    {inv.status === 'Pending' && (
                      <button
                        onClick={() => handlePay(inv.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition"
                      >
                        Pay Now
                      </button>
                    )}
                    <button
                      onClick={() => alert(`Downloading PDF for invoice ${inv.id}`)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                    >
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
