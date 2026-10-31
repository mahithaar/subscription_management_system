import React, { useState } from 'react';
import { Layers, CheckCircle2, Plus, ArrowRight, X } from 'lucide-react';
import { mockPlans } from '../data/mockData';

export default function PlansView({ onNavigate, triggerNewPlanModal, setTriggerNewPlanModal, onToast, customPlans = [], onAddPlan }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const plans = [...customPlans, ...mockPlans];
  const [showModal, setShowModal] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanDesc, setNewPlanDesc] = useState('');

  // Handle external trigger from Topbar button
  if (triggerNewPlanModal && !showModal) {
    setShowModal(true);
    setTriggerNewPlanModal(false);
  }

  const handleSavePlan = () => {
    if (!newPlanName || !newPlanPrice) {
      if (onToast) onToast('Please enter plan name and price', 'warning');
      return;
    }
    const createdPlan = {
      id: `plan-${Date.now()}`,
      name: newPlanName,
      description: newPlanDesc || 'Configured recurring SaaS tier with custom quotas.',
      price: `₹${parseInt(newPlanPrice).toLocaleString('en-IN')}`,
      period: 'per month',
      popular: false,
      activeSubscribers: 1,
      mrr: `₹${parseInt(newPlanPrice).toLocaleString('en-IN')}`,
      features: [
        'Automated monthly invoicing',
        'Stripe & Razorpay auto-charge',
        'Custom webhooks & API access',
        'Standard 24/7 SLA'
      ]
    };
    if (onAddPlan) onAddPlan(createdPlan);
    setShowModal(false);
    setNewPlanName('');
    setNewPlanPrice('');
    setNewPlanDesc('');
    if (onToast) onToast(`New plan "${createdPlan.name}" added successfully!`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Subscription Plans</h1>
          <p className="text-sm text-slate-400">Configure recurring pricing tiers, feature checklists, and billing frequencies.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#16181e] p-1 rounded-xl border border-[#232733] flex items-center text-xs font-semibold">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billingCycle === 'monthly' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Yearly</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">Save 20%</span>
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Plan</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const priceNumber = parseInt(plan.price.replace(/[^\d]/g, ''), 10) || 999;
          const displayPrice = billingCycle === 'yearly' 
            ? `₹${Math.round(priceNumber * 12 * 0.8).toLocaleString('en-IN')}` 
            : plan.price;
          const displayPeriod = billingCycle === 'yearly' ? '/year' : '/month';

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                plan.popular
                  ? 'bg-gradient-to-b from-[#1e1c18] to-[#14151b] border-2 border-orange-500/60 shadow-xl shadow-orange-950/20'
                  : 'bg-[#14161d] border border-[#232733] hover:border-slate-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-4 right-4 bg-orange-500 text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-sm">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{plan.description}</p>

                <div className="flex items-baseline gap-1 my-4 pb-4 border-b border-slate-800">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{displayPrice}</span>
                  <span className="text-xs text-slate-400">{displayPeriod}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#0e1015] border border-slate-800/80 mb-6 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Subscribers</span>
                    <p className="font-bold text-white mt-0.5">{plan.activeSubscribers}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Plan MRR</span>
                    <p className="font-bold text-emerald-400 mt-0.5">{plan.mrr}</p>
                  </div>
                </div>

                <div className="space-y-2.5 mb-6">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Features included</div>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onNavigate('subscriptions')}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  plan.popular
                    ? 'bg-orange-500 hover:bg-orange-400 text-white shadow-md shadow-orange-500/30'
                    : 'bg-[#1e222d] hover:bg-slate-700 text-white'
                }`}
              >
                <span>View Subscribers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#14161d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Create New Plan Tier</h3>
            <p className="text-xs text-slate-400 mt-1">Configure pricing tier to start onboarding subscribers.</p>
            
            <div className="space-y-4 my-5">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dedicated Enterprise Plus"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#0e1015] border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Monthly Price (₹ INR)</label>
                <input
                  type="number"
                  placeholder="2999"
                  value={newPlanPrice}
                  onChange={(e) => setNewPlanPrice(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#0e1015] border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Summary of target tier and included SLA..."
                  value={newPlanDesc}
                  onChange={(e) => setNewPlanDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-[#0e1015] border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-400 text-white shadow-md shadow-orange-500/20 transition cursor-pointer"
              >
                Save & Publish Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
