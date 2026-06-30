import { useTranslation } from "react-i18next";
import { Skeleton } from "./Skeleton";

export default function PageSkeleton({ label }) {
  const { t } = useTranslation();

  return (
    <div className="route-skeleton flex min-h-screen items-center justify-center bg-slate-50 px-5 py-8 dark:bg-slate-950">
      <div className="w-full max-w-5xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="mt-3 h-8 w-52 rounded-full" />
          </div>
          <Skeleton className="h-10 w-28 rounded-2xl" />
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.42fr]">
          <Skeleton className="h-80 rounded-3xl" />
          <div className="space-y-4">
            <Skeleton className="h-36 rounded-3xl" />
            <Skeleton className="h-36 rounded-3xl" />
          </div>
        </div>
        <p className="sr-only">{label || t("authUi.loadingWorkspace")}</p>
      </div>
    </div>
  );
}
