import { BrandIcon } from '../ui/Icons'
import { useTranslation } from "react-i18next";
import mongezMark from '../../assets/MongezMLogo.svg'
import mongezWordmark from '../../assets/Mongez.svg'

function FooterSection() {
  const { t } = useTranslation();
  const footerColumns = t("landing.footer.columns", { returnObjects: true });

  return (
    <footer id="footer" className="bg-[#0f172a] px-6 py-20 text-white lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 border-b border-white/8 pb-14 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br  ">
                <img src={mongezMark} alt={t("landing.nav.markAlt")} className="h-12 w-9 object-contain" />
              </div>
              <div className="flex flex-col">
                <img src={mongezWordmark} alt={t("landing.nav.wordmarkAlt")} className="h-12 w-auto object-contain" />
              </div>
            </div>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-400">
              {t("landing.footer.description")}
            </p>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">{column.title}</p>
              <div className="mt-6 space-y-4">
                {column.links.map((link) => (
                  link.href ? (
                    <a key={link.label} href={link.href} className="block text-lg text-slate-400 transition hover:text-white">
                      {link.label}
                    </a>
                  ) : (
                    <span key={link.label} className="block cursor-not-allowed text-lg text-slate-500" aria-disabled="true">
                      {link.label}
                    </span>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-6 pt-8 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{t("landing.footer.copyright")}</p>
          <div className="flex items-center gap-5 text-xl">
            <button type="button" aria-label={t("landing.footer.socialX")} disabled className="cursor-not-allowed opacity-60">
              <BrandIcon name="x" />
            </button>
            <button type="button" aria-label={t("landing.footer.socialLinkedIn")} disabled className="cursor-not-allowed opacity-60">
              <BrandIcon name="linkedin" />
            </button>
            <button type="button" aria-label={t("landing.footer.socialGitHub")} disabled className="cursor-not-allowed opacity-60">
              <BrandIcon name="github" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default FooterSection
