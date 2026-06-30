
const StatCard = ({ value, label, color }) => {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className={`text-[28px] font-extrabold tracking-tight ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{label}</div>
    </div>
  );
}

export default StatCard
