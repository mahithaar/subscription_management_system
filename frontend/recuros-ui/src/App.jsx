import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardView from './views/DashboardView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-[#0d0f12] text-slate-100 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar activeTab={activeTab} />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
          {activeTab !== 'dashboard' && (
            <div className="text-slate-400 p-12 text-center bg-[#16181e] border border-[#232733] rounded-2xl shadow-sm">
              <h2 className="text-xl font-bold text-white capitalize">{activeTab} Manager</h2>
              <p className="mt-2 text-sm text-slate-400">Integrated with RecurOS API</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

