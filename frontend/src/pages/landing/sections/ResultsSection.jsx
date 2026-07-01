import SectionBadge from './SectionBadge'
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

function ResultsSection() {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const metrics = t("landing.results.metrics", { returnObjects: true });

  return (
    <section id="results" className="landing-section landing-results bg-[#0f172a] px-6 py-24 text-white lg:px-10" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-6xl text-center">
        <SectionBadge icon="chart">{t("landing.results.badge")}</SectionBadge>
        <h2 className="mt-6 text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl">{t("landing.results.title")}</h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-400">
          {t("landing.results.description")}
        </p>
        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <article
              key={metric.label}
              style={{ "--landing-index": index }}
              className="landing-metric-card rounded-[2rem] border border-white/8 bg-white px-8 py-12 text-slate-900 shadow-[0_30px_60px_rgba(0,0,0,0.3)]"
            >
              <p className="text-5xl font-black tracking-[-0.05em] text-sky-600">{metric.value}</p>
              <p className="mt-5 text-lg font-medium text-slate-500">{metric.label}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ResultsSection
