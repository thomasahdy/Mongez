import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import mongezMark from '../../assets/MongezMLogo.svg';
import { completeOnboarding } from '../../services/api/authService';

const INDUSTRIES = [
  { value: 'NGO', label: 'Non-Governmental Organization (NGO)' },
  { value: 'CORP', label: 'Corporation / Business' },
  { value: 'GOV', label: 'Government / Public Sector' },
  { value: 'EDU', label: 'Education / Academic' },
];

const SIZES = [
  { value: 'SMALL', label: 'Small (1-10 members)' },
  { value: 'MEDIUM', label: 'Medium (11-50 members)' },
  { value: 'LARGE', label: 'Large (50+ members)' },
];

const TEMPLATES = [
  {
    id: 'project-board',
    title: 'Project Board',
    description: 'A standard Kanban board with To Do, In Progress, and Done columns for general task management.',
    icon: '📋',
  },
  {
    id: 'ngo-operations',
    title: 'NGO Operations',
    description: 'Tailored for non-profits: track funding status, donation drives, outreach activities, and volunteer assignments.',
    icon: '🤝',
  },
  {
    id: 'blank',
    title: 'Blank Board',
    description: 'Start with a clean slate and configure columns, fields, and automation completely from scratch.',
    icon: '✨',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('NGO');
  const [size, setSize] = useState('MEDIUM');
  const [country, setCountry] = useState('EG');
  const [selectedTemplate, setSelectedTemplate] = useState('project-board');
  const [invites, setInvites] = useState([{ email: '', role: 'MEMBER' }]);

  const handleAddInvite = () => {
    setInvites([...invites, { email: '', role: 'MEMBER' }]);
  };

  const handleInviteChange = (index, field, value) => {
    const updated = [...invites];
    updated[index][field] = value;
    setInvites(updated);
  };

  const handleRemoveInvite = (index) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const handleNextStep = () => {
    if (step === 1 && !orgName.trim()) {
      setError('Organization name is required');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setStep(1);
      setError('Organization name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const validInvites = invites.filter((inv) => inv.email.trim() !== '');

      const result = await completeOnboarding(
        {
          name: orgName.trim(),
          industry,
          size,
          country,
        },
        selectedTemplate,
        validInvites
      );

      // Store selection in local storage
      if (result.spaceId) {
        localStorage.setItem('activeSpaceId', result.spaceId);
      }
      if (result.defaultBoardId) {
        localStorage.setItem('activeBoardId', result.defaultBoardId);
      }

      // Redirect to spaces list page
      navigate('/spaces', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Onboarding failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      {/* Header */}
      <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-950">
        <div className="flex items-center gap-2.5">
          <img src={mongezMark} alt="" className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight">Mongez</span>
        </div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Step {step} of 3
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 relative overflow-hidden animate-fadeIn">
          {/* Top subtle decorative gradient */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* STEP 1: Organization Info */}
            {step === 1 && (
              <div className="space-y-5 animate-slideLeft">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Create your workspace</h2>
                  <p className="text-sm text-slate-500 mt-1">Set up a space for your team's projects and boards.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="orgName">
                      Organization Name *
                    </label>
                    <input
                      id="orgName"
                      type="text"
                      required
                      placeholder="e.g. Acme Corporation, Hope NGO"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="industry">
                        Industry
                      </label>
                      <select
                        id="industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
                      >
                        {INDUSTRIES.map((ind) => (
                          <option key={ind.value} value={ind.value}>
                            {ind.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="size">
                        Organization Size
                      </label>
                      <select
                        id="size"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-sky-400 outline-none text-sm"
                      >
                        {SIZES.map((sz) => (
                          <option key={sz.value} value={sz.value}>
                            {sz.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="country">
                      Country Location (2-letter ISO)
                    </label>
                    <input
                      id="country"
                      type="text"
                      maxLength={2}
                      placeholder="e.g. EG, US, GB"
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none transition-all text-sm font-semibold tracking-wide"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold hover:shadow-lg transition duration-200 text-sm cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Template Selection */}
            {step === 2 && (
              <div className="space-y-5 animate-slideLeft">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Choose a template</h2>
                  <p className="text-sm text-slate-500 mt-1">Select a starting board configuration for your team.</p>
                </div>

                <div className="space-y-3.5">
                  {TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer flex gap-4 items-start ${
                        selectedTemplate === tmpl.id
                          ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/50'
                      }`}
                    >
                      <span className="text-3xl p-1 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 w-12 h-12">
                        {tmpl.icon}
                      </span>
                      <div className="space-y-0.5">
                        <div className="font-bold text-sm">{tmpl.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {tmpl.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold hover:shadow-lg transition duration-200 text-sm cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Invite Team */}
            {step === 3 && (
              <div className="space-y-5 animate-slideLeft">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Invite your team</h2>
                  <p className="text-sm text-slate-500 mt-1">Add coworkers to collaborate on projects. You can also skip this for now.</p>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {invites.map((invite, index) => (
                    <div key={index} className="flex gap-2 items-center animate-fadeIn">
                      <input
                        type="email"
                        placeholder="coworker@email.com"
                        value={invite.email}
                        onChange={(e) => handleInviteChange(index, 'email', e.target.value)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent outline-none focus:ring-2 focus:ring-sky-400 text-sm"
                      />
                      <select
                        value={invite.role}
                        onChange={(e) => handleInviteChange(index, 'role', e.target.value)}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                      >
                        <option value="MEMBER">Member</option>
                        <option value="ADMIN">Admin</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                      {invites.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInvite(index)}
                          className="p-2.5 text-slate-400 hover:text-red-500 transition rounded-lg"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddInvite}
                  className="text-xs font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1.5 focus:outline-none"
                >
                  + Add another invite
                </button>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handlePrevStep}
                    className="flex-1 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition text-sm disabled:opacity-50 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold hover:shadow-lg transition duration-200 text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Setting up...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
