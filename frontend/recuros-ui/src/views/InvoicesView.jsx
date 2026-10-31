import React, { useState } from 'react';
import { FileText, CheckCircle2, Clock, AlertCircle, Download, ExternalLink, X, Printer } from 'lucide-react';
import { mockInvoices } from '../data/mockData';

export default function InvoicesView({ onNavigate, refreshTrigger = 0, onToast }) {
  const [filter, setFilter] = useState('ALL');
  const [invoices, setInvoices] = useState(mockInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const handlePay = (id) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'Paid' } : inv));
    if (onToast) onToast(`Invoice ${id} marked as Paid via gateway transaction!`, 'success');
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition cursor-pointer"
                      >
                        Pay Now
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
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

      {/* Invoice PDF Printable Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14161d] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Printable Invoice Header */}
            <div className="border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-extrabold text-white">Recur<span className="text-orange-400">OS</span> Tax Invoice</h3>
                  <p className="text-[11px] text-slate-400">GSTIN: 29AAACA1234A1Z5 | Bangalore, KA</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-orange-400">{selectedInvoice.id}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Date: {selectedInvoice.date}</p>
                </div>
              </div>
            </div>

            {/* Bill To */}
            <div className="p-3 bg-[#0d0f12] rounded-xl border border-slate-800 text-xs mb-4">
              <span className="text-slate-500 text-[10px] uppercase font-bold">Billed To:</span>
              <p className="font-bold text-white mt-0.5">{selectedInvoice.customer}</p>
              <p className="text-slate-400">{selectedInvoice.company}</p>
            </div>

            {/* Breakdown Table */}
            <div className="space-y-2 text-xs border-b border-slate-800 pb-4 mb-4">
              <div className="flex justify-between text-slate-300">
                <span>{selectedInvoice.plan} (Subscription Tier)</span>
                <span className="font-medium text-white">{selectedInvoice.amount}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>CGST (9%)</span>
                <span>₹{Math.round(parseInt(selectedInvoice.tax.replace(/[^\d]/g, '') || 300) / 2)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>SGST (9%)</span>
                <span>₹{Math.round(parseInt(selectedInvoice.tax.replace(/[^\d]/g, '') || 300) / 2)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                <span>Total Due</span>
                <span className="text-emerald-400">{selectedInvoice.total}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                Status: {selectedInvoice.status}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
