import { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { useAppContext } from '../AppContext';
import { getBillingPlans, getSpaceBilling, upgradePlan } from '../../lib/billingApi';

export default function BillingPage() {
  const { spaceId: routeSpaceId } = useParams();
  const { user, activeSpace, spaces } = useAppContext();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [billingInfo, setBillingInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  const spaceId = routeSpaceId || activeSpace?.id || spaces[0]?.id || localStorage.getItem('mongez.activeSpaceId');

  const loadBilling = useCallback(async () => {
    if (!spaceId) {
      setLoading(false);
      setError('No workspace selected. Open Spaces and select a workspace first.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [plansData, billingData] = await Promise.all([
        getBillingPlans(spaceId),
        getSpaceBilling(spaceId),
      ]);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setCurrentPlan(billingData.currentPlan || billingData.plan);
      setBillingInfo(billingData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handleUpgradePlan = async (planId) => {
    if (!spaceId) return;
    try {
      setUpgrading(true);
      const data = await upgradePlan(spaceId, planId);
      setCurrentPlan(data.plan || plans.find((plan) => plan.id === planId));
      await loadBilling();
      alert(data.message || 'Plan updated.');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpgrading(false);
    }
  };

  const getFeatures = (planType) => {
    const features = {
      free: ['Up to 3 projects', 'Basic task management', '5 team members', '1 GB storage', 'Email support'],
      starter: ['Unlimited projects', 'AI chat', '25 team members', '50 GB storage', 'Priority email support'],
      professional: ['AI reports & risk scans', 'Unlimited team members', '500 GB storage', 'Timeline views', 'API access'],
      enterprise: ['All Professional features', 'Unlimited storage', '24/7 support', 'SSO & SAML', 'SLA'],
    };
    return features[planType] || [];
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading billing information...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Billing & Plans</h1>
          <p className="text-lg text-slate-600">Feature access powered by workspace flags and usage analytics</p>
          {spaceId && <p className="mt-2 text-sm text-slate-400">Workspace: {spaceId}</p>}
        </div>

        {currentPlan && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-12 border-l-4 border-sky-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{currentPlan.name || 'Current Plan'}</h2>
                {billingInfo?.usageStats && (
                  <p className="text-slate-600 mt-2">
                    <span className="mr-4">Members: {billingInfo.usageStats.teamMembers || 0}</span>
                    <span className="mr-4">Tasks: {billingInfo.usageStats.projects || 0}</span>
                    <span>Done: {billingInfo.usageStats.doneCount || 0}</span>
                  </p>
                )}
              </div>
              {currentPlan.price !== undefined && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-sky-600">
                    ${currentPlan.price}
                    <span className="text-sm text-slate-600">/month</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.length > 0 ? (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg ${
                  currentPlan?.id === plan.id ? 'border-2 border-sky-500 bg-sky-50' : 'bg-white border border-slate-200'
                }`}
              >
                <div className="bg-linear-to-r from-sky-500 to-sky-600 px-6 py-4">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-white">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-sm ml-2">/month</span>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 mb-4">{plan.description}</p>
                  <ul className="space-y-3 mb-6">
                    {(plan.features || getFeatures(plan.type || plan.name?.toLowerCase())).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <i className="fas fa-check text-green-500 text-xs mt-1 shrink-0" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {currentPlan?.id === plan.id ? (
                    <button disabled className="w-full py-2 px-4 rounded-lg font-semibold text-slate-600 bg-slate-100 cursor-not-allowed">
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgradePlan(plan.id)}
                      disabled={upgrading}
                      className="w-full py-2 px-4 rounded-lg font-semibold text-white bg-sky-500 hover:bg-sky-600 transition-colors disabled:opacity-50"
                    >
                      {upgrading ? 'Updating...' : `Select ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-500">No pricing plans available for this workspace.</p>
            </div>
          )}
        </div>

        {user && (
          <p className="text-center text-sm text-slate-500">Logged in as {user.email || user.name}</p>
        )}
      </div>
    </div>
  );
}
