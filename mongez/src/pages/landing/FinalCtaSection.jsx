import { Icon } from '../../components/Icons'

function FinalCtaSection() {
  return (
    <section
      id="final-cta"
      className="bg-[radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,#17243b_0%,#121b2d_100%)] px-6 py-24 text-white lg:px-10"
    >
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-7xl">
          Ready to Execute
          <br />
          with Clarity?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Join organizations that have transformed their operations with AI-powered execution.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#hero"
            className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-base font-semibold text-white shadow-[0_20px_45px_rgba(14,165,233,0.35)] transition hover:-translate-y-0.5"
          >
            <Icon name="rocket" />
            Start Free
          </a>
          <a
            href="#footer"
            className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.12] px-8 py-4 text-base font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.16]"
          >
            <Icon name="calendar" />
            Book Demo
          </a>
        </div>
      </div>
    </section>
  )
}

export default FinalCtaSection
