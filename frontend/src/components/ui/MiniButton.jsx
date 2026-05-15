const MiniButton = ({ variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600',
    primary: 'bg-sky-500 border-sky-500 text-white hover:bg-sky-600',
    danger: 'bg-red-500 border-red-500 text-white hover:bg-red-600',
  }

  return (
    <button
      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors ${variants[variant] || variants.default}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default MiniButton