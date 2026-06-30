import useLocaleDirection from "../../hooks/useLocaleDirection";

const PriorityBar = ({ item }) => {
  const { dir } = useLocaleDirection();

  return (
    <div dir={dir}>
      <div className="flex items-center justify-between mb-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-semibold">{item.pct}%</span>
      </div>
      {/* Track */}
      <div
        className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={item.pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${item.label}: ${item.pct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${item.pct}%`, background: item.color }}
        />
      </div>
    </div>
  );
}

export default PriorityBar
