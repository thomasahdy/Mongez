
const NotifActionButton = ({ icon, title, onClick }) => {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={title}
      aria-label={title}
      className="w-7 h-7 flex items-center justify-center border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-slate-400 text-[11px] hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
    </button>
  );
}

export default NotifActionButton
