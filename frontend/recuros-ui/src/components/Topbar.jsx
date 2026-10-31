import React from 'react';
import { Search, Bell, Calendar, ChevronDown, Plus } from 'lucide-react';

export default function Topbar({ activeTab, onActionClick }) {
  const titles = {
    dashboard: 'Subscription Dashboard',
    plans: 'Subscription Plans',
    customers: 'Customer Directory',
    subscriptions: 'Subscriptions Manager',
    invoices: 'Billing & Invoices',
    payments: 'Payment Transactions',
    settings: 'System & Profile Settings',
  };

  const actionLabels = {
    dashboard: '+ Create Report',
    plans: '+ New Plan',
    customers: '+ Add Customer',
    subscriptions: '+ New Subscription',
    invoices: '+ Create Invoice',
    payments: 'Export Records',
    settings: 'Save Changes',
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30">
      {/* Search Input Bar */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search plans, invoices, customers..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-700 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Date Filter Badge matching reference */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>01 Dec 2024 - 31 Dec 2024</span>
        </div>

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
