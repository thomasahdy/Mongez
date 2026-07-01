import { Icon } from '../../../components/ui/Icons'

function SectionBadge({ icon, children, dark = false, className = '' }) {
  return (
    <span
      className={`landing-badge inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${
        dark
          ? 'border-white/10 bg-white/[0.08] text-violet-200'
          : 'border-sky-100 bg-white text-sky-600 shadow-[0_16px_40px_rgba(43,123,255,0.08)]'
      } ${className}`.trim()}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {children}
    </span>
  )
}

export default SectionBadge
