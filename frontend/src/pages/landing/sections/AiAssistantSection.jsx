import { Icon } from '../../../components/ui/Icons'
import SectionBadge from './SectionBadge'
import { useTranslation } from "react-i18next";

function AiAssistantSection() {
  const { t } = useTranslation();
  const aiPrompts = t("landing.aiSection.prompts", { returnObjects: true });
  const messages = t("landing.aiSection.messages", { returnObjects: true });

  return (
    <section id="ai-assistant" className="bg-[linear-gradient(180deg,#1e293b_0%,#0f172a_100%)] px-6 py-24 text-white lg:px-10">
      <div className="mx-auto max-w-5xl text-center">
        <SectionBadge icon="brain" dark>
          {t("landing.aiSection.badge")}
        </SectionBadge>
        <h2 className="mx-auto mt-6 max-w-2xl text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl">
          {t("landing.aiSection.titleLineOne")}
          <br />
          {t("landing.aiSection.titleLineTwo")}
        </h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-300">
          {t("landing.aiSection.description")}
        </p>

        <div className="mt-14 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_80px_rgba(5,8,18,0.4)] backdrop-blur-xl sm:p-6">
          <div className="flex items-center gap-4 border-b border-white/10 px-3 pb-4 text-left">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
              <Icon name="robot" />
            </div>
            <div>
              <p className="font-bold text-white">{t("landing.aiSection.assistantName")}</p>
              <p className="text-sm text-slate-400">{t("landing.aiSection.assistantSubtitle")}</p>
            </div>
          </div>

          <div className="grid gap-6 px-2 py-6 text-left lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message}
                  className={`rounded-3xl rounded-tl-md px-5 py-4 ${
                    index === 0
                      ? "max-w-[85%] bg-sky-500/20 text-slate-100"
                      : index === 1
                        ? "max-w-[90%] bg-white/[0.08] text-slate-200"
                        : "max-w-[70%] bg-violet-500/20 text-slate-100"
                  }`}
                >
                  {message}
                </div>
              ))}
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-[#334155] p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">{t("landing.aiSection.suggestedActions")}</p>
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
                placeholder={t("landing.aiSection.inputPlaceholder")}
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
