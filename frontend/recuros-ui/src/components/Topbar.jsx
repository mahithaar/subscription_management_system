import { Search, Bell, Clock, Play, RotateCcw } from 'lucide-react';

export default function Topbar({ activeTab, clockDate = 'Today', isSimulated = false, onAdvanceTime, onResetTime, onRunBilling }) {
  const titles = {
    dashboard: 'Subscription Dashboard',
    plans: 'Subscription Plans',
    customers: 'Customer Directory',
    subscriptions: 'Subscriptions Manager',
    invoices: 'Billing & Invoices',
    payments: 'Payment Transactions',
    settings: 'System & Profile Settings',
  };

  return (
    <header className="h-20 bg-[#111217] border-b border-[#1e222d] px-8 flex items-center justify-between sticky top-0 z-30 text-white">
      {/* Search Input Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search plans, invoices, customers..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-[#16181e] border border-[#232733] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-200 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Time Machine Controls */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16181e] border border-amber-500/40 rounded-xl text-xs font-medium text-slate-200 shadow-sm">
          <Clock className={`w-3.5 h-3.5 ${isSimulated ? 'text-purple-400' : 'text-amber-400'}`} />
          <span className="text-[11px] text-slate-400">Clock:</span>
          <span className={`font-mono font-bold ${isSimulated ? 'text-purple-300' : 'text-amber-400'}`}>{clockDate}</span>
          {onAdvanceTime && (
            <button 
              onClick={onAdvanceTime} 
              className="ml-1.5 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded text-[11px] font-semibold transition"
              title="Advance virtual clock by 30 days"
            >
              +30 Days
            </button>
          )}
          {onResetTime && (
            <button 
              onClick={onResetTime} 
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
              title="Reset to real time"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Run Billing Action Button */}
        {onRunBilling && (
          <button 
            onClick={onRunBilling} 
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>Run Billing</span>
          </button>
        )}

        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-semibold text-xs flex items-center justify-center shadow-sm">
            AC
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-800">Alex Carter</div>
            <div className="text-[10px] text-slate-400 font-medium">Administrator</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
        </div>

        {/* Action Button */}
        <button
          onClick={onActionClick}
          className="ml-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#111217] text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
        >
          {actionLabels[activeTab] || '+ New Action'}
        </button>
      </div>
    </header>
  );
}
