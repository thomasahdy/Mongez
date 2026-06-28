import { Icon } from '../../../components/ui/Icons'
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../../hooks/useLocaleDirection";

function FinalCtaSection() {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <section
      id="final-cta"
      className="bg-[radial-gradient(circle_at_bottom_left,rgba(0,168,232,0.15),transparent_28%),linear-gradient(180deg,#1e293b_0%,#0f172a_100%)] px-6 py-24 text-white lg:px-10"
    >
      <div className="mx-auto max-w-4xl text-center" dir={isRTL ? "rtl" : "ltr"}>
        <h2 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-7xl">
          {t("landing.finalCta.titleLineOne")}
          <br />
          {t("landing.finalCta.titleLineTwo")}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          {t("landing.finalCta.description")}
        </p>
        <div className={`mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row ${isRTL ? "sm:flex-row-reverse" : ""}`}>
          <a
            href="#hero"
            className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-base font-semibold text-white shadow-[0_20px_45px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5"
          >
            <Icon name="rocket" />
            {t("landing.finalCta.primaryCta")}
          </a>
          <a
            href="#footer"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.12] px-8 py-4 text-base font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.16]"
          >
            <Icon name="calendar" />
            {t("landing.finalCta.secondaryCta")}
          </a>
        </div>
      </div>
    </section>
  )
}

export default FinalCtaSection
