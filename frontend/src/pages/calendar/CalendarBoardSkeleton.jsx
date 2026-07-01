const CalendarBoardSkeleton = () => {
  return (
    <div className="calendar-skeleton rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, index) => (
          <div key={index} className="min-h-[120px] rounded-2xl bg-slate-100 p-3">
            <div className="h-6 w-8 rounded-full bg-slate-200" />
            <div className="mt-5 space-y-2">
              <div className="h-4 rounded-lg bg-slate-200" />
              <div className="h-4 w-2/3 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarBoardSkeleton;
