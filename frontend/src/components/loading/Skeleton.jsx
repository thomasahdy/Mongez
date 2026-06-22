export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200 ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-2xl" />
        <Skeleton className="h-2 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-24" />
      <Skeleton className="mt-2 h-4 w-28" />
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
