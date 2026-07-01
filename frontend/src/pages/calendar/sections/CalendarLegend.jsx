export default function CalendarLegend({ legendItems }) {
  return (
    <div className="flex flex-wrap gap-2">
      {legendItems.map((item) => (
        <div key={item.label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${item.className}`}>
          <span className="h-2 w-2 rounded-full bg-current opacity-75" />
          {item.label}
        </div>
      ))}
    </div>
  );
}
