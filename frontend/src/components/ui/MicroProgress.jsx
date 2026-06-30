
const MicroProgress = ({ value = 0 }) => {
  return (
    <div className="h-[3px] rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2.5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export default MicroProgress
