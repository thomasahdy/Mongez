import { Icon } from '../../components/Icons'
import SectionBadge from './SectionBadge'

const problemCards = [
  {
    icon: 'bars',
    title: 'Tasks get lost in spreadsheets, emails, and scattered tools.',
    text: 'Nothing has a single source of truth.',
  },
  {
    icon: 'user-clock',
    title: 'Approvals delay progress for weeks.',
    text: "No visibility into where things are stuck or who's blocking whom.",
  },
  {
    icon: 'lock',
    title: 'Funding gets blocked without visibility.',
    text: "Donors and ministries can't see impact, leading to delayed tranches.",
  },
  {
    icon: 'users',
    title: 'No centralized oversight.',
    text: 'Department heads operate in silos with zero cross-functional visibility.',
  },
  {
    icon: 'clipboard',
    title: 'Manual reporting chaos.',
    text: 'Hours vanish into status updates instead of mission-critical work.',
  },
]

const floatingIssues = [
  { icon: 'warning', label: '23 days blocked', tone: 'text-rose-500' },
  { icon: 'clock', label: 'Overdue', tone: 'text-amber-500' },
  { icon: 'excel', label: 'Excel reports', tone: 'text-orange-500' },
  { icon: 'question', label: 'Who owns this?', tone: 'text-slate-400' },
  { icon: 'ban', label: 'No budget', tone: 'text-red-400' },
]

function ProblemSection() {
  return (
    <section id="problem" className="px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionBadge icon="sparkles">The Problem</SectionBadge>
          <h2 className="mt-6 text-4xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl">
            Managing NGOs & Teams Shouldn&apos;t Feel Like Firefighting.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-500">
            Legacy tools create more problems than they solve. Teams drown in manual processes while opportunities slip away.
          </p>
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {problemCards.map((item) => (
              <article key={item.title} className="flex gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-400">
                  <Icon name={item.icon} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
                  <p className="mt-1 text-slate-500">{item.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="relative mx-auto flex h-[460px] w-full max-w-[420px] items-center justify-center">
            <div className="absolute h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.10),transparent_100%)]" />
            {floatingIssues.map((issue, index) => {
              const positions = ['left-12 top-4', 'right-0 top-16', 'right-16 top-1/2', 'left-0 top-[58%]', 'right-4 bottom-8']

              return (
                <div
                  key={issue.label}
                  className={`absolute ${positions[index]} rounded-2xl border border-white bg-white px-5 py-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]`}
                >
                  <div className={`flex items-center gap-2 text-sm font-semibold ${issue.tone}`}>
                    <Icon name={issue.icon} className="h-3.5 w-3.5" />
                    {issue.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProblemSection
