import { Icon } from '../../components/Icons'
import SectionBadge from './SectionBadge'

const aiPrompts = [
  'Draft a follow-up for the delayed finance approval in Cairo.',
  'Which projects are at risk this week and why?',
  'Summarize donor-ready highlights for the education portfolio.',
]

function AiAssistantSection() {
  return (
    <section id="ai-assistant" className="bg-[linear-gradient(180deg,#18243b_0%,#111b2f_100%)] px-6 py-24 text-white lg:px-10">
      <div className="mx-auto max-w-5xl text-center">
        <SectionBadge icon="brain" dark>
          AI Assistant
        </SectionBadge>
        <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl">
          Meet Your AI
          <br />
          Operations Manager.
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          Mongez AI detects risks, drafts communications, schedules follow-ups, and suggests reassignments automatically.
        </p>

        <div className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_80px_rgba(5,8,18,0.4)] backdrop-blur-xl sm:p-6">
          <div className="flex items-center gap-4 border-b border-white/10 px-3 pb-4 text-left">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
              <Icon name="robot" />
            </div>
            <div>
              <p className="font-bold text-white">Mongez AI</p>
              <p className="text-sm text-slate-400">Your intelligent operations co-pilot</p>
            </div>
          </div>

          <div className="grid gap-6 px-2 py-6 text-left lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="max-w-[85%] rounded-3xl rounded-tl-md bg-sky-500/20 px-5 py-4 text-slate-100">
                I found 3 project risks this week and prepared follow-ups for each owner.
              </div>
              <div className="max-w-[90%] rounded-3xl rounded-tl-md bg-white/[0.08] px-5 py-4 text-slate-200">
                Budget approval for the health initiative is blocked for 9 days. I can escalate to finance and draft a donor-safe update.
              </div>
              <div className="max-w-[70%] rounded-3xl rounded-tl-md bg-violet-500/20 px-5 py-4 text-slate-100">
                Want me to send it now?
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-[#141f34] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Suggested actions</p>
              <div className="mt-4 space-y-3">
                {aiPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.06] px-4 py-4 text-left text-sm text-slate-200 transition hover:border-sky-400/40 hover:bg-sky-500/10"
                  >
                    <Icon name="wand" className="mt-0.5 text-sky-300" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 px-3 pt-4">
            <input
              type="text"
              placeholder="Ask Mongez AI anything..."
              className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5"
            >
              <Icon name="send" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AiAssistantSection
