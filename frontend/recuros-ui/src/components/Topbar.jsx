import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Bell, Clock, Play, RotateCcw, ChevronDown, 
  CheckCircle2, ShieldCheck, User, LogOut, Settings as SettingsIcon, 
  FileSpreadsheet, X, CreditCard, Sparkles, Layers, FileText, ArrowRight
} from 'lucide-react';
import { mockCustomers, mockInvoices, mockSubscriptions, mockPlans } from '../data/mockData';

export default function Topbar({ 
  activeTab = 'dashboard', 
  clockDate = 'Today', 
  isSimulated = false, 
  onAdvanceTime, 
  onResetTime, 
  onRunBilling,
  onActionClick,
  onNavigate
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  // Global Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const actionLabels = {
    dashboard: '+ Create Report',
    plans: '+ New Plan',
    customers: '+ Add Customer',
    subscriptions: '+ New Subscription',
    invoices: '+ Create Invoice',
    payments: 'Export Records',
    settings: 'Save Changes',
  };

  const notifications = [
    {
      id: 1,
      title: 'Billing Run Completed',
      desc: 'Idempotency Shield verified. 2 invoices issued.',
      time: 'Just now',
      unread: true,
      icon: ShieldCheck,
      color: 'text-emerald-400 bg-emerald-500/20'
    },
    {
      id: 2,
      title: 'Payment Received',
      desc: 'Acme Corp paid ₹5,898 via Razorpay UPI.',
      time: '12m ago',
      unread: true,
      icon: CreditCard,
      color: 'text-orange-400 bg-orange-500/20'
    },
    {
      id: 3,
      title: 'Time Machine Synchronized',
      desc: `Simulation clock running at ${clockDate}.`,
      time: '1h ago',
      unread: true,
      icon: Clock,
      color: 'text-purple-400 bg-purple-500/20'
    },
    {
      id: 4,
      title: 'New Subscriber Joined',
      desc: 'Nexus Technologies upgraded to Enterprise Annual Tier.',
      time: '3h ago',
      unread: false,
      icon: Sparkles,
      color: 'text-amber-400 bg-amber-500/20'
    }
  ];

  // Perform multi-entity search
  const q = searchQuery.trim().toLowerCase();
  const matchedCustomers = q ? mockCustomers.filter(c => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)).slice(0, 3) : [];
  const matchedInvoices = q ? mockInvoices.filter(i => i.id.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q) || i.plan.toLowerCase().includes(q)).slice(0, 3) : [];
  const matchedSubs = q ? mockSubscriptions.filter(s => s.id.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q) || s.plan.toLowerCase().includes(q)).slice(0, 3) : [];
  const matchedPlans = q ? mockPlans.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)).slice(0, 2) : [];
  const totalMatches = matchedCustomers.length + matchedInvoices.length + matchedSubs.length + matchedPlans.length;

  const handleSelectResult = (tab) => {
    if (onNavigate) onNavigate(tab);
    setIsSearchFocused(false);
    setSearchQuery('');
  };

  return (
    <header className="h-20 bg-[#111217] border-b border-[#1e222d] px-8 flex items-center justify-between sticky top-0 z-30 text-white select-none">
      {/* Search Input Bar with Live Results Dropdown */}
      <div className="flex items-center gap-4 flex-1 max-w-md relative" ref={searchRef}>
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search plans, invoices, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            className="w-full pl-10 pr-9 py-2 text-sm bg-[#16181e] border border-[#232733] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-slate-200 placeholder-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchFocused && searchQuery.trim() && (
          <div className="absolute top-12 left-0 right-0 bg-[#16181e] border border-[#282d3d] rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span>{totalMatches} results for "{searchQuery}"</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">Esc to close</span>
            </div>

            {totalMatches === 0 && (
              <div className="py-6 text-center text-xs text-slate-500">
                No matching customers, invoices, subscriptions, or plans found.
              </div>
            )}

            {/* Customers Group */}
            {matchedCustomers.length > 0 && (
              <div className="py-2">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider px-2">Customers</span>
                {matchedCustomers.map(c => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectResult('customers')}
                    className="p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-semibold text-white">{c.name}</span>
                      <span className="text-[11px] text-slate-400 ml-2">({c.company})</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400">{c.spent}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Invoices Group */}
            {matchedInvoices.length > 0 && (
              <div className="py-2 border-t border-slate-800/60">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2">Invoices</span>
                {matchedInvoices.map(i => (
                  <div
                    key={i.id}
                    onClick={() => handleSelectResult('invoices')}
                    className="p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-mono font-bold text-orange-400">{i.id}</span>
                      <span className="text-[11px] text-slate-300 ml-2">{i.customer}</span>
                    </div>
                    <span className="font-bold text-white">{i.total}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Subscriptions Group */}
            {matchedSubs.length > 0 && (
              <div className="py-2 border-t border-slate-800/60">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider px-2">Subscriptions</span>
                {matchedSubs.map(s => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectResult('subscriptions')}
                    className="p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <span className="font-mono text-purple-300 font-bold">{s.id}</span>
                      <span className="text-[11px] text-slate-300 ml-2">{s.customer}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{s.plan}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Plans Group */}
            {matchedPlans.length > 0 && (
              <div className="py-2 border-t border-slate-800/60">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider px-2">Plans</span>
                {matchedPlans.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectResult('plans')}
                    className="p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer flex items-center justify-between text-xs transition"
                  >
                    <span className="font-semibold text-white">{p.name}</span>
                    <span className="font-bold text-emerald-400">{p.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
              className="ml-1.5 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded text-[11px] font-semibold transition cursor-pointer"
              title="Advance virtual clock by 30 days"
            >
              +30 Days
            </button>
          )}
          {onResetTime && (
            <button 
              onClick={onResetTime} 
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition cursor-pointer"
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>Run Billing</span>
          </button>
        )}

        {/* Notifications Dropdown Container */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
              setUnreadCount(0);
            }}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Activity Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-[#16181e] border border-[#282d3d] rounded-2xl shadow-2xl p-4 z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">System Activity</h4>
                  <span className="px-1.5 py-0.2 text-[10px] bg-orange-500/20 text-orange-400 font-bold rounded">Live</span>
                </div>
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="divide-y divide-slate-800/80 my-2 max-h-72 overflow-y-auto">
                {notifications.map(n => {
                  const Icon = n.icon;
                  return (
                    <div key={n.id} className="py-2.5 flex items-start gap-3 hover:bg-slate-800/30 px-1 rounded-lg transition">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${n.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                          <span className="text-[10px] text-slate-500">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{n.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 text-center">
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 cursor-pointer"
                >
                  Close Panel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown Container */}
        <div className="relative" ref={profileRef}>
          <div 
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
            className="flex items-center gap-3 pl-2 border-l border-slate-800 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white font-semibold text-xs flex items-center justify-center shadow-sm">
              AC
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition">Alex Carter</div>
              <div className="text-[10px] text-slate-400 font-medium">Administrator</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
          </div>

          {showProfile && (
            <div className="absolute right-0 mt-3 w-64 bg-[#16181e] border border-[#282d3d] rounded-2xl shadow-2xl p-4 z-50 animate-fadeIn">
              <div className="pb-3 border-b border-slate-800">
                <p className="text-xs font-bold text-white">Alex Carter</p>
                <p className="text-[11px] text-slate-400">admin@brightloop.io</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Role: Super Admin
                </span>
              </div>

              <div className="space-y-1 my-2 text-xs">
                <div 
                  onClick={() => {
                    if (onNavigate) onNavigate('settings');
                    setShowProfile(false);
                  }}
                  className="px-3 py-2 text-slate-300 hover:bg-slate-800/60 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <span>System Settings</span>
                  <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="px-3 py-2 text-slate-300 hover:bg-slate-800/60 rounded-xl flex items-center justify-between cursor-pointer">
                  <span>API Key</span>
                  <span className="font-mono text-[10px] text-slate-500">recuros_live_***</span>
                </div>
                <div className="px-3 py-2 text-slate-300 hover:bg-slate-800/60 rounded-xl flex items-center justify-between cursor-pointer">
                  <span>Audit Mode</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Enabled</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setShowProfile(false);
                    if (onNavigate) onNavigate('dashboard');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-orange-400 hover:text-orange-300 hover:bg-slate-800 transition text-left cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Action Button */}
        <button
          onClick={onActionClick}
          className="ml-2 px-4 py-2 rounded-xl text-xs font-semibold bg-orange-500 hover:bg-orange-400 text-white transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          {actionLabels[activeTab] || '+ New Action'}
        </button>
      </div>
    </header>
  );
}
