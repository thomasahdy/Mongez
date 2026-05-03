import { Icon } from '../../components/Icons'
import SectionBadge from './SectionBadge'

function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden px-6 pb-24 pt-16 lg:px-10 lg:pt-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_35%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.1),transparent_30%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="relative mx-auto max-w-6xl text-center">
        <SectionBadge icon="sparkles">AI-Powered Project Management</SectionBadge>
        <h1 className="mx-auto mt-8 max-w-3xl text-5xl font-black tracking-[-0.05em] text-slate-900 sm:text-6xl lg:text-7xl">
          From <span className="text-sky-700">Chaos</span>
          <br />
          to <span className="text-sky-500">Clarity.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-500">
          Mongez uses AI to manage projects, detect risks, and automate execution for NGOs and organizations that demand
          results.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#features"
            className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-7 py-4 text-base font-semibold text-white shadow-[0_20px_45px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5"
          >
            <Icon name="rocket" />
            Get Started
          </a>
          <a
            href="#ai-assistant"
            className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-700 shadow-[0_16px_35px_rgba(15,23,42,0.08)] transition hover:border-sky-200 hover:text-sky-600"
          >
            <Icon name="play" />
            Watch Demo
          </a>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-[0_35px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 pb-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-300" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
            </div>
            <span className="text-xs font-medium text-slate-400">mongez.app/board/education</span>
            <span className="h-3 w-3 rounded-full bg-slate-100" />
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[0.9fr_2.7fr_1fr]">
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="h-3 w-24 rounded-full bg-sky-500" />
              <div className="mt-4 space-y-3">
                {[90, 72, 60, 80].map((w) => (
                  <div key={w} className="h-3 rounded-full bg-slate-200" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {['Inbox', 'In Progress', 'Review', 'Done'].map((column, index) => (
                <div key={column} className="rounded-3xl bg-slate-50 p-3 text-left">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">{column}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-400">{index + 3}</span>
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="rounded-2xl bg-white p-3 shadow-sm">
                        <div
                          className={`mb-3 h-1.5 w-10 rounded-full ${
                            index === 0 ? 'bg-sky-400' : index === 1 ? 'bg-amber-400' : index === 2 ? 'bg-blue-500' : 'bg-emerald-400'
                          }`}
                        />
                        <div className="h-2.5 w-4/5 rounded-full bg-slate-200" />
                        <div className="mt-2 h-2.5 w-2/3 rounded-full bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl bg-slate-50 p-4 text-left">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-600">
                <Icon name="robot" />
                Mongez AI
              </div>
              <div className="space-y-3">
                {['Funding milestone at risk', 'Approval bottleneck detected', 'Donor report ready to export'].map((item, index) => (
                  <div
                    key={item}
                    className={`rounded-2xl px-3 py-3 text-sm ${
                      index === 0 ? 'bg-rose-50 text-rose-500' : index === 1 ? 'bg-amber-50 text-amber-500' : 'bg-sky-50 text-sky-500'
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
