import { Icon } from '../../components/Icons'
import SectionBadge from './SectionBadge'

const testimonials = [
  {
    quote:
      'Mongez transformed how we manage our education programs. The AI risk detection alone saved us from three critical funding delays last quarter.',
    name: 'Ahmed Hassan',
    role: 'Director of Programs, Al-Noor Foundation',
    initials: 'AH',
    accent: 'bg-blue-500',
  },
  {
    quote:
      'The automated workflows eliminated 60% of our manual follow-ups. Our team now focuses on impact, not administration.',
    name: 'Sarah Mahmoud',
    role: 'Operations Lead, CARE International',
    initials: 'SM',
    accent: 'bg-violet-500',
  },
  {
    quote:
      'Finally a tool that understands NGO workflows. The donor reporting feature alone is worth 10x the investment and our reports are impeccable.',
    name: 'Fatma Khalil',
    role: 'CEO, Youth Empowerment Network',
    initials: 'FK',
    accent: 'bg-emerald-500',
  },
]

function TestimonialsSection() {
  return (
    <section id="testimonials" className="px-6 py-24 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <SectionBadge icon="sparkles">Testimonials</SectionBadge>
          <h2 className="mt-6 text-4xl font-black tracking-[-0.04em] text-slate-900 sm:text-5xl lg:text-6xl">
            Trusted by Leading Organizations.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-500">
            See how teams across the globe are transforming their operations with Mongez.
          </p>
        </div>

        <div className="mt-16 grid gap-6 xl:grid-cols-3">
          {testimonials.map((item) => (
            <article
              key={item.name}
              className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_45px_rgba(15,23,42,0.06)]"
            >
              <div className="flex gap-1 text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Icon key={`${item.name}-${index}`} name="sparkles" className="h-3.5 w-3.5" />
                ))}
              </div>
              <p className="mt-6 text-xl leading-9 text-slate-600">&quot;{item.quote}&quot;</p>
              <div className="mt-8 flex items-center gap-4">
                <div className={`grid h-14 w-14 place-items-center rounded-full text-sm font-bold text-white ${item.accent}`}>
                  {item.initials}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-400">{item.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TestimonialsSection
