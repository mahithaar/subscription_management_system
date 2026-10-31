import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Users, 
  CreditCard, 
  FileText, 
  Receipt, 
  Settings, 
  Sparkles,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'plans', label: 'Plans', icon: Layers },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="w-64 bg-[#111217] border-r border-[#1e222d] flex flex-col justify-between select-none shrink-0 min-h-screen text-slate-300">
      <div>
        {/* Brand Logo */}
        <div className="px-6 py-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <TrendingUp className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white">Recur<span className="text-orange-400">OS</span></span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Subscription Platform</p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group text-left ${
                  isActive
                    ? 'bg-[#1e1c18] text-amber-400 border border-amber-500/30 shadow-sm shadow-orange-950/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Upgrade Pro Card (Matching reference design) */}
      <div className="p-4 m-3 rounded-2xl bg-gradient-to-b from-[#1c1d24] to-[#14151b] border border-slate-800/80 shadow-md">
        <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center mb-3">
          <Sparkles className="w-4 h-4" />
        </div>
        <h4 className="text-sm font-semibold text-white">Upgrade to Pro</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Automate dunning, webhooks & multi-currency billing.
        </p>
        <button className="mt-3.5 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-slate-900 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 shadow-sm transition-all">
          <span>Upgrade Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
