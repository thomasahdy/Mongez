import { Icon } from '../../components/Icons'

const featureRows = [
  {
    title: 'Smart Task Board',
    description:
      'Organize initiatives across teams with AI-powered prioritization, clear owners, and operational signals in one place.',
    bullets: ['Status tracking that feels effortless', 'Dependencies mapped automatically', 'Deadlines surfaced before they slip'],
    imageLeft: false,
    accent: 'from-sky-500 to-cyan-400',
    preview: 'kanban',
  },
  {
    title: 'AI Risk Detection',
    description:
      'Catch execution blockers early with signals from approvals, budgets, workloads, and pending follow-ups.',
    bullets: ['Automatic risk scoring', 'Suggested interventions', 'Cross-project bottleneck visibility'],
    imageLeft: true,
    accent: 'from-rose-400 to-orange-300',
    preview: 'risks',
  },
  {
    title: 'Automated Workflows',
    description:
      'Build repeatable flows for reminders, escalations, approvals, and stakeholder communication without busywork.',
    bullets: ['Follow-ups sent automatically', 'Clear audit trail', 'Reduced manual coordination'],
    imageLeft: false,
    accent: 'from-emerald-400 to-cyan-400',
    preview: 'automation',
  },
  {
    title: 'Department Management',
    description:
      'Give each unit its own view while leadership keeps a single command center for outcomes, budgets, and progress.',
    bullets: ['Shared operating system', 'Granular visibility', 'Role-based collaboration'],
    imageLeft: true,
    accent: 'from-blue-500 to-indigo-400',
    preview: 'departments',
  },
  {
    title: 'Donor & Ministry Reports',
    description:
      'Translate execution data into polished reporting with metrics, timelines, and impact snapshots ready to share.',
    bullets: ['Live charts and rollups', 'Export-ready summaries', 'Evidence-backed updates'],
    imageLeft: false,
    accent: 'from-sky-500 to-violet-400',
    preview: 'reports',
  },
]

function FeatureMockup({ accent, preview }) {
  const isRiskPreview = preview === 'risks'
  const isAutomationPreview = preview === 'automation'
  const isDepartmentPreview = preview === 'departments'
  const isReportsPreview = preview === 'reports'

  return (
    <div className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
      <div className="mb-4 flex items-center gap-2 px-2">
        <span className="h-3 w-3 rounded-full bg-rose-300" />
        <span className="h-3 w-3 rounded-full bg-amber-300" />
        <span className="h-3 w-3 rounded-full bg-emerald-300" />
      </div>
      {!isRiskPreview && !isAutomationPreview && !isDepartmentPreview && !isReportsPreview && (
        <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className={`h-24 rounded-[1.25rem] bg-gradient-to-br ${accent} opacity-85`} />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-14 rounded-2xl bg-white shadow-sm" />
              <div className="h-14 rounded-2xl bg-white shadow-sm" />
            </div>
          </div>
          <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-3 w-28 rounded-full bg-slate-200" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                  <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${accent} opacity-80`} />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-24 rounded-full bg-slate-200" />
                    <div className="h-2.5 w-full rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isRiskPreview && (
        <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 rounded-full bg-slate-300" />
            <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-500">3 at risk</span>
          </div>
          <div className={`h-20 rounded-[1.25rem] bg-gradient-to-br ${accent} opacity-85`} />
          <div className="grid gap-2 sm:grid-cols-2">
            {['Blocked approvals', 'Budget mismatch', 'Overdue owner'].map((risk) => (
              <div key={risk} className="rounded-2xl border border-rose-100 bg-white px-3 py-3 text-xs text-slate-600 shadow-sm">
                <div className="mb-2 h-2 w-12 rounded-full bg-rose-300" />
                {risk}
              </div>
            ))}
          </div>
        </div>
      )}

      {isAutomationPreview && (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <div className="rounded-3xl bg-slate-50 p-4">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="mt-4 space-y-3">
              {['New task created', 'Owner inactive 48h', 'Deadline in 24h'].map((trigger) => (
                <div key={trigger} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                  {trigger}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className={`h-10 rounded-2xl bg-gradient-to-r ${accent} opacity-90`} />
            <div className="my-3 flex items-center justify-center text-slate-300">...</div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-3 text-xs text-sky-600">
              Auto-send reminder and escalate to lead
            </div>
            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs text-emerald-600">
              Generate weekly summary for stakeholders
            </div>
          </div>
        </div>
      )}

      {isDepartmentPreview && (
        <div className="grid gap-3 sm:grid-cols-2">
          {['Programs', 'Finance', 'Operations', 'Partnerships'].map((dept, index) => (
            <div key={dept} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">{dept}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${index % 2 === 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
              <div className="mt-3 space-y-2">
                <div className={`h-2.5 rounded-full bg-gradient-to-r ${accent} opacity-70`} style={{ width: `${85 - index * 12}%` }} />
                <div className="h-2.5 rounded-full bg-slate-200" style={{ width: `${68 - index * 9}%` }} />
                <div className="h-2.5 rounded-full bg-slate-200" style={{ width: `${90 - index * 15}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isReportsPreview && (
        <div className="space-y-4 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div className="h-3 w-28 rounded-full bg-slate-300" />
            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-600">Live export</span>
          </div>
          <div className="grid grid-cols-5 items-end gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-4">
            {[45, 72, 58, 84, 66].map((height, index) => (
              <div
                key={height}
                className={`rounded-t-lg bg-gradient-to-t ${index % 2 ? 'from-blue-600 to-sky-400' : 'from-violet-500 to-indigo-400'}`}
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {['Impact score 92%', 'Funding secured +38%', 'Tasks completed 1,284'].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-medium text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="bg-[#F1F5F9] px-6 py-24 text-[#0F172A] lg:px-10">
      <div className="mx-auto max-w-6xl space-y-24">
        {featureRows.map((feature) => (
          <div
            key={feature.title}
            className={`grid items-center gap-12 ${feature.imageLeft ? 'lg:grid-cols-[1fr_0.95fr]' : 'lg:grid-cols-[0.95fr_1fr]'}`}
          >
            <div className={feature.imageLeft ? 'lg:order-1' : ''}>
              <FeatureMockup accent={feature.accent} preview={feature.preview} />
            </div>
            <div className={feature.imageLeft ? 'lg:order-2' : ''}>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">AI Features</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-[#0F172A] sm:text-5xl">{feature.title}</h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#475569]">{feature.description}</p>
              <div className="mt-8 space-y-4">
                {feature.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-center gap-3 text-slate-[#475569]">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                      <Icon name="trend" className="h-3.5 w-3.5" />
                    </div>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default FeaturesSection
