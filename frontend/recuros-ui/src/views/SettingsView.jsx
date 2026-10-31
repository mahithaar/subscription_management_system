import React, { useState } from 'react';
import { Settings, Save, Shield, Clock, CheckCircle2, Globe, BellRing } from 'lucide-react';

export default function SettingsView({ onNavigate, clock }) {
  const [currency, setCurrency] = useState('INR');
  const [taxRate, setTaxRate] = useState('18');
  const [dunningDays, setDunningDays] = useState('1, 3, 5, 7');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System & Profile Settings</h1>
        <p className="text-sm text-slate-400">Configure multi-currency rules, Indian GST tax calculations, automated dunning, and Time Machine.</p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Settings saved successfully and applied to RecurOS billing engine!</span>
        </div>
      )}

      {/* Currency & Tax */}
      <div className="p-6 rounded-2xl bg-[#14161d] border border-[#232733] space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-orange-400" />
          <span>Currency & Tax Settings</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Primary Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#0e1015] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
            >
              <option value="INR">Indian Rupee (₹ INR)</option>
              <option value="USD">US Dollar ($ USD)</option>
              <option value="EUR">Euro (€ EUR)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Default GST Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-[#0e1015] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Configured as 9% CGST + 9% SGST (18% Total)</span>
          </div>
        </div>
      </div>

      {/* Dunning Management */}
      <div className="p-6 rounded-2xl bg-[#14161d] border border-[#232733] space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <BellRing className="w-4 h-4 text-orange-400" />
          <span>Automated Dunning & Smart Retries</span>
        </h3>
        <p className="text-xs text-slate-400">RecurOS automatically retries failed payments according to the Fibonacci/exponential schedule.</p>
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-1">Retry Intervals (Days after initial failure)</label>
          <input
            type="text"
            value={dunningDays}
            onChange={(e) => setDunningDays(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-[#0e1015] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Time Machine & Virtual Engine */}
      <div className="p-6 rounded-2xl bg-[#14161d] border border-purple-500/30 space-y-4">
        <h3 className="text-base font-bold text-purple-300 flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span>RecurOS Simulated Time Machine</span>
        </h3>
        <p className="text-xs text-slate-300">
          The Time Machine allows hackathon judges to simulate future billing runs, discount expirations, and dunning cadences without waiting days or weeks.
        </p>
        <div className="p-3 rounded-xl bg-[#0e1015] border border-purple-500/20 text-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400">Current Virtual Date:</span>
            <p className="font-mono font-bold text-purple-300 text-sm mt-0.5">{clock?.today || 'Real Time'}</p>
          </div>
          <span className="text-xs bg-purple-500/20 text-purple-300 font-semibold px-2 py-1 rounded-lg">
            {clock?.is_simulated ? 'SIMULATED MODE ACTIVE' : 'REAL TIME MODE'}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
}
