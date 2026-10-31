import React, { useState } from 'react';
import { CreditCard, Play, Pause, XCircle, Search, TrendingUp, Users, ArrowUpRight } from 'lucide-react';
import { mockSubscriptions } from '../data/mockData';

export default function SubscriptionsView({ onNavigate, refreshTrigger = 0 }) {
  const [subs, setSubs] = useState(mockSubscriptions);
  const [search, setSearch] = useState('');

  const togglePause = (id) => {
    setSubs(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, status: s.status === 'Paused' ? 'Active' : 'Paused' };
      }
      return s;
    }));
  };

  const cancelSub = (id) => {
    if (confirm('Are you sure you want to cancel this subscription?')) {
      setSubs(prev => prev.map(s => s.id === id ? { ...s, status: 'Cancelled' } : s));
    }
  };

  const filtered = subs.filter(s => 
    s.customer.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.plan.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733]">
          <span className="text-xs text-slate-400">Total Active</span>
          <p className="text-2xl font-extrabold text-white mt-1">126</p>
          <span className="text-[11px] text-emerald-400 mt-1 inline-block">↑ 8.4% this month</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733]">
          <span className="text-xs text-slate-400">MRR Velocity</span>
          <p className="text-2xl font-extrabold text-white mt-1">₹84,300</p>
          <span className="text-[11px] text-emerald-400 mt-1 inline-block">↑ 12.5% recurring</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733]">
          <span className="text-xs text-slate-400">ARPU (Avg Revenue)</span>
          <p className="text-2xl font-extrabold text-white mt-1">₹669</p>
          <span className="text-[11px] text-slate-400 mt-1 inline-block">Across all cohorts</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#14161d] border border-[#232733]">
          <span className="text-xs text-slate-400">Monthly Churn Rate</span>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">1.8%</p>
          <span className="text-[11px] text-slate-400 mt-1 inline-block">Industry benchmark &lt; 3.0%</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Subscription Management</h1>
          <p className="text-sm text-slate-400">Control active recurring billing agreements, pause periods, and renewal schedules.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search subscriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-xs bg-[#14161d] border border-[#232733] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 w-64"
          />
        </div>
      </div>

      <div className="bg-[#14161d] rounded-2xl border border-[#232733] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#1e222d] uppercase tracking-wider font-semibold bg-[#111217]/50">
                <th className="py-3.5 px-5">ID & Customer</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4">Cycle</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Next Renewal</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e222d]">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5">
                    <div>
                      <div className="font-semibold text-white">{sub.customer}</div>
                      <div className="text-[11px] font-mono text-orange-400">{sub.id}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-300">{sub.plan}</td>
                  <td className="py-3.5 px-4 text-slate-400">{sub.billingCycle}</td>
                  <td className="py-3.5 px-4 font-bold text-white">{sub.amount}</td>
                  <td className="py-3.5 px-4 text-slate-300 font-mono">{sub.nextBilling}</td>
                  <td className="py-3.5 px-4 text-slate-400">{sub.paymentMethod}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      sub.status === 'Active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                      sub.status === 'Paused' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                      sub.status === 'Past Due' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right space-x-2">
                    {sub.status !== 'Cancelled' && (
                      <button
                        onClick={() => togglePause(sub.id)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      >
                        {sub.status === 'Paused' ? 'Resume' : 'Pause'}
                      </button>
                    )}
                    {sub.status !== 'Cancelled' && (
                      <button
                        onClick={() => cancelSub(sub.id)}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-400 hover:bg-rose-500/30 transition"
                      >
                        Cancel
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
