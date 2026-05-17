import SectionBadge from './SectionBadge'

const metrics = [
  { value: '92%', label: 'On-Time Delivery' },
  { value: '3.4x', label: 'Faster Approvals' },
  { value: '60%', label: 'Less Manual Reporting' },
  { value: '100%', label: 'Execution Clarity' },
]

function ResultsSection() {
  return (
    <section id="results" className="bg-[#04060a] px-6 py-24 text-white lg:px-10">
      <div className="mx-auto max-w-6xl text-center">
        <SectionBadge icon="chart">Impact</SectionBadge>
        <h2 className="mt-6 text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl">Real Results, Measured.</h2>
        <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-400">
          Organizations using Mongez consistently achieve transformational improvements across every dimension.
        </p>
        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-[2rem] border border-white/8 bg-white px-8 py-12 text-slate-900 shadow-[0_30px_60px_rgba(0,0,0,0.3)]"
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
