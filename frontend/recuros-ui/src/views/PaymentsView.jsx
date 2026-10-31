import React, { useState } from 'react';
import { Receipt, CheckCircle2, AlertCircle, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { mockPayments } from '../data/mockData';

export default function PaymentsView({ onNavigate, refreshTrigger = 0 }) {
  const [payments, setPayments] = useState(mockPayments);

  const handleRefund = (id) => {
    if (confirm(`Refund transaction ${id}?`)) {
      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: 'Refunded' } : p));
      alert(`Transaction ${id} refunded successfully via payment gateway.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gateway Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Razorpay India</span>
            <p className="text-lg font-bold text-white mt-0.5">UPI & Cards (₹ INR)</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Live
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Stripe Global</span>
            <p className="text-lg font-bold text-white mt-0.5">International (USD/EUR)</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Live
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733] flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">Success Rate</span>
            <p className="text-lg font-bold text-emerald-400 mt-0.5">98.4% Succeeded</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Healthy
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Payment Transactions</h1>
          <p className="text-sm text-slate-400">Live payment audit trail, refund processing, and automated reconciliation.</p>
        </div>
      </div>

      <div className="bg-[#14161d] rounded-2xl border border-[#232733] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#1e222d] uppercase tracking-wider font-semibold bg-[#111217]/50">
                <th className="py-3.5 px-5">Transaction ID</th>
                <th className="py-3.5 px-4">Invoice Ref</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Gateway</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e222d]">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-white">{p.id}</td>
                  <td className="py-3.5 px-4 font-mono text-orange-400">{p.invoiceId}</td>
                  <td className="py-3.5 px-4 font-medium text-white">{p.customer}</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-400">{p.amount}</td>
                  <td className="py-3.5 px-4 text-slate-400">{p.method}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-300">{p.gateway}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      p.status === 'Successful' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      p.status === 'Failed' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                      'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{p.timestamp}</td>
                  <td className="py-3.5 px-5 text-right">
                    {p.status === 'Successful' && (
                      <button
                        onClick={() => handleRefund(p.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-400 hover:bg-rose-500/30 transition"
                      >
                        Refund
                      </button>
                    )}
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
