import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, Bell, Clock, Play, RotateCcw, ChevronDown, 
  CheckCircle2, ShieldCheck, User, LogOut, Settings as SettingsIcon, 
  FileSpreadsheet, X, CreditCard, Sparkles
} from 'lucide-react';

export default function Topbar({ 
  activeTab = 'dashboard', 
  clockDate = 'Today', 
  isSimulated = false, 
  onAdvanceTime, 
  onResetTime, 
  onRunBilling,
  onActionClick
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
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

  return (
    <header className="h-20 bg-[#111217] border-b border-[#1e222d] px-8 flex items-center justify-between sticky top-0 z-30 text-white select-none">
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
                  className="text-slate-400 hover:text-white"
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
                  className="text-[11px] font-semibold text-orange-400 hover:text-orange-300"
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
                    alert('Session active: Logged in as System Administrator.');
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition text-left"
                >
                  Verify Session Status
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
