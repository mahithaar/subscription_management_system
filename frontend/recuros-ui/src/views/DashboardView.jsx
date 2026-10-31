import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  CreditCard, 
  FileWarning, 
  ArrowUpRight, 
  ArrowDownRight, 
  MoreVertical,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { mockDashboardData } from '../data/mockData';
import { apiRequest } from '../api';

export default function DashboardView({ onNavigate, refreshTrigger = 0 }) {
  const [chartTab, setChartTab] = useState('revenue');
  const [liveKpis, setLiveKpis] = useState(null);
  const [liveInvoices, setLiveInvoices] = useState(null);
  const { metrics, revenueTrend, subscriptionStatus, recentInvoices, popularPlans } = mockDashboardData;

  useEffect(() => {
    async function loadData() {
      try {
        const metricsData = await apiRequest('/dashboard/metrics');
        if (metricsData && metricsData.kpis) {
          setLiveKpis(metricsData.kpis);
        }
      } catch (err) {
        console.warn('Metrics load error:', err);
      }
      try {
        const invs = await apiRequest('/invoices');
        if (Array.isArray(invs)) {
          setLiveInvoices(invs);
        }
      } catch (err) {
        console.warn('Invoices load error:', err);
      }
    }
    loadData();
  }, [refreshTrigger]);

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    }
    if (s === 'confirmed' || s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> {s === 'confirmed' ? 'Confirmed' : 'Pending'}
        </span>
      );
    }
    if (s === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Clock className="w-3 h-3" /> Draft
        </span>
      );
    }
    if (s === 'failed' || s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3 h-3" /> {s === 'cancelled' ? 'Cancelled' : 'Failed'}
        </span>
      );
    }
    return <span className="text-xs text-slate-500">{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Title header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Subscription Dashboard</h1>
          <p className="text-sm text-slate-300">Track recurring revenue, churn velocity, and member growth in real time.</p>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* MRR Card - Featured Black Card like Reference */}
        <div className="bg-[#111217] text-white p-5 rounded-2xl border border-slate-800 shadow-xl shadow-slate-950/10 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
            <button className="text-slate-500 hover:text-slate-300">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-400 font-medium">Monthly Recurring Revenue</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1 text-white">
              {liveKpis ? `₹${Number(liveKpis.mrr).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : metrics.mrr.value}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{metrics.mrr.change}</span>
              <span className="text-slate-500 font-normal">{metrics.mrr.period}</span>
            </div>
          </div>
          {/* Subtle decorative glow */}
          <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
        </div>

        {/* Active Subscriptions Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-500 font-medium">Active Subscriptions</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900">
              {liveKpis ? liveKpis.active_subscriptions : metrics.activeSubscriptions.value}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{metrics.activeSubscriptions.change}</span>
              <span className="text-slate-400 font-normal">{metrics.activeSubscriptions.period}</span>
            </div>
          </div>
        </div>

        {/* Total Customers Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-500 font-medium">Total Customers</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900">
              {liveKpis ? liveKpis.total_customers : metrics.totalCustomers.value}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{metrics.totalCustomers.change}</span>
              <span className="text-slate-400 font-normal">{metrics.totalCustomers.period}</span>
            </div>
          </div>
        </div>

        {/* Pending Invoices Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <FileWarning className="w-5 h-5" />
            </div>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="text-xs text-slate-500 font-medium">Pending Invoices</div>
            <div className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900">
              {liveKpis ? `₹${Number(liveKpis.overdue_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : metrics.pendingInvoices.value}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-slate-500">
              <ArrowDownRight className="w-3.5 h-3.5 text-amber-500" />
              <span>{liveKpis ? `${liveKpis.overdue_count} overdue` : 'Action required'}</span>
              <span className="text-slate-400 font-normal">for collection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section: Revenue Overview + Subscription Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-900">Revenue Overview</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">Total recurring revenue and forecast from 01 Dec - 31 Dec 2024</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-medium">
                <button
                  onClick={() => setChartTab('revenue')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartTab === 'revenue' ? 'bg-[#111217] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setChartTab('forecast')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    chartTab === 'forecast' ? 'bg-[#111217] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Target
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="targetGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#facc15" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#facc15" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#111217] text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
                          <p className="font-semibold text-slate-300">{label}</p>
                          <p className="text-amber-400 font-bold mt-1">
                            {chartTab === 'revenue' ? 'Recurring Revenue' : 'Projected Target'}: ₹{payload[0].value.toLocaleString('en-IN')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartTab === 'revenue' ? 'revenue' : 'target'}
                  stroke={chartTab === 'revenue' ? '#f97316' : '#facc15'}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill={chartTab === 'revenue' ? 'url(#revenueGradient)' : 'url(#targetGradient)'}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Status Donut Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900">Subscription Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribution of subscriber pool</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600">Active</span>
          </div>

          <div className="relative h-44 flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subscriptionStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {subscriptionStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#111217] text-white p-2.5 rounded-xl text-xs shadow-md">
                          <p className="font-medium text-amber-400">{data.name}</p>
                          <p className="text-slate-300">{data.count} subscriptions ({data.percentage}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="text-xs text-slate-400 font-medium">Total</span>
              <p className="text-xl font-bold text-slate-900">126</p>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            {subscriptionStatus.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Invoices + Popular Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices Table (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Invoices</h3>
              <p className="text-xs text-slate-400">Latest recurring billing transactions</p>
            </div>
            <button
              onClick={() => onNavigate('invoices')}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100 uppercase tracking-wider font-semibold">
                  <th className="pb-3 pl-1">Customer</th>
                  <th className="pb-3">Plan</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right pr-1">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {((liveInvoices && liveInvoices.length > 0)
                  ? liveInvoices.slice(0, 6).map((inv) => ({
                      id: inv.number || `INV-${inv.id}`,
                      customer: inv.customer_name || `Customer #${inv.customer_id}`,
                      plan: inv.subscription_number || 'Recurring Plan',
                      amount: `₹${Number(inv.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                      date: inv.invoice_date,
                      status: inv.state ? inv.state.charAt(0).toUpperCase() + inv.state.slice(1) : 'Pending',
                      avatar: (inv.customer_name ? inv.customer_name.charAt(0) : 'C').toUpperCase()
                    }))
                  : recentInvoices
                ).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pl-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-800 font-bold flex items-center justify-center text-[11px]">
                          {inv.avatar}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{inv.customer}</div>
                          <div className="text-[10px] text-slate-400">{inv.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600 font-medium">{inv.plan}</td>
                    <td className="py-3 font-semibold text-slate-900">{inv.amount}</td>
                    <td className="py-3 text-slate-500">{inv.date}</td>
                    <td className="py-3 text-right pr-1">{getStatusBadge(inv.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Popular Subscription Plans */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900">Popular Plans</h3>
              <p className="text-xs text-slate-400">By customer adoption rate</p>
            </div>
            <button
              onClick={() => onNavigate('plans')}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>Explore</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 mt-4">
            {popularPlans.map((plan) => (
              <div
                key={plan.name}
                className="p-3.5 rounded-xl border border-slate-200/70 hover:border-orange-300 hover:shadow-sm transition-all bg-gradient-to-r from-slate-50/60 to-white"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900">{plan.name}</div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    {plan.tag}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-lg font-extrabold text-slate-900">{plan.price}</span>
                  <span className="text-xs text-slate-400">{plan.billing}</span>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>{plan.subscribers} Subscribers</span>
                  <span className="font-semibold text-emerald-600">{plan.growth} this mo.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
