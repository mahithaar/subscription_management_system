import React, { useState } from 'react';
import { Users, Search, MoreVertical, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { mockCustomers } from '../data/mockData';

export default function CustomersView({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  const filtered = mockCustomers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          c.company.toLowerCase().includes(search.toLowerCase()) ||
                          c.email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'ALL' || c.status.toUpperCase() === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Active</span>;
      case 'trialing':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Trialing</span>;
      case 'past due':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">Past Due</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">Cancelled</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Customer Directory</h1>
          <p className="text-sm text-slate-400">Manage client accounts, lifetime value, and active subscriptions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search customers or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs bg-[#14161d] border border-[#232733] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 w-64"
            />
          </div>
          <button 
            onClick={() => alert('Customer invite modal opened')}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-xl text-xs font-bold transition shadow-md shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1e222d] pb-3 text-xs font-semibold text-slate-400">
        {['ALL', 'ACTIVE', 'TRIALING', 'PAST DUE', 'CANCELLED'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              filter === tab ? 'bg-orange-500 text-white shadow-sm' : 'hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#14161d] rounded-2xl border border-[#232733] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-[#1e222d] uppercase tracking-wider font-semibold bg-[#111217]/50">
                <th className="py-3.5 px-5">Customer</th>
                <th className="py-3.5 px-4">Company</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4">Lifetime Spend</th>
                <th className="py-3.5 px-4">Joined Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e222d]">
              {filtered.map(cust => (
                <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-xs">
                        {cust.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{cust.name}</div>
                        <div className="text-[11px] text-slate-400">{cust.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-300">{cust.company}</td>
                  <td className="py-3.5 px-4 font-semibold text-amber-400">{cust.plan}</td>
                  <td className="py-3.5 px-4 font-bold text-white">{cust.spent}</td>
                  <td className="py-3.5 px-4 text-slate-400">{cust.joinDate}</td>
                  <td className="py-3.5 px-4">{getStatusBadge(cust.status)}</td>
                  <td className="py-3.5 px-5 text-right">
                    <button 
                      onClick={() => onNavigate('subscriptions')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-orange-400 hover:text-white bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition"
                    >
                      Manage
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
