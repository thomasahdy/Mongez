import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../../components/ui/Button";
import { useSpaces } from "../../hooks/api/useSpaces";
import useLocaleDirection from "../../hooks/useLocaleDirection";

const ReportsToolbar = ({selectedSpace, setSelectedSpace}) => {
    const { t } = useTranslation();
    const { dir } = useLocaleDirection();
    const dateFilters = useMemo(
      () => [
        t("reportsPage.periods.last30Days"),
        t("reportsPage.periods.thisQuarter"),
        t("reportsPage.periods.thisYear"),
      ],
      [t],
    );
    const [activePeriod, setActivePeriod] = useState(t("reportsPage.periods.last30Days"));
    const { data: spaces, isLoading, error } = useSpaces();

    const rawSpacesList = Array.isArray(spaces) ? spaces : (spaces?.spaces || []);
  const normalizedSpaces = rawSpacesList.map((space) => ({
    ...space,
    gradient: space.gradient || 'from-indigo-500 to-indigo-400',
    initials: space.initials || (space.name ? space.name.charAt(0).toUpperCase() : 'S'),
    isOwner: space.isOwner !== undefined ? space.isOwner : space.role === 'OWNER',
    stats: {
      departments: space.stats?.departments ?? space._count?.departments ?? 0,
      boards: space.stats?.boards ?? space._count?.boards ?? 0,
      members: space.stats?.members ?? space._count?.memberships ?? space.memberCount ?? 1,
    },
    departments: space.departments || [],
  }));
    return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm mb-6" dir={dir}>
      {/* Date range */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label={t("reportsPage.dateRangeAria")}>
        {dateFilters.map((label) => (
          <Button
            key={label}
            variant="outline"
            size="md"
            active={activePeriod === label}
            onClick={() => setActivePeriod(label)}
            aria-pressed={activePeriod === label}
          >
            {label}
          </Button>
        ))}

        <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1 shrink-0" role="separator" aria-hidden="true" />

        <Button variant="outline" size="md">
          <i className="fa-regular fa-calendar text-[12px]" aria-hidden="true" />
          {t("reportsPage.periods.customDate")}
        </Button>
      </div>

      {/* Dropdowns */}
      <div className="flex items-center gap-2 shrink-0" role="group" aria-label={t("reportsPage.scopeAria")}>
        <Button variant="outline" size="md" aria-haspopup="listbox" aria-expanded="false">
          <i className="fa-regular fa-user text-[12px]" aria-hidden="true" />
          {t("reportsPage.allMembers")}
          <i className="fa-solid fa-chevron-down text-[10px]" aria-hidden="true" />
        </Button>
        <select
          id="spaces"
          name="spaces"
          value={selectedSpace}
          onChange={(e) => setSelectedSpace(e.target.value)}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all duration-150 cursor-pointer border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 border-slate-200 dark:border-slate-600 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
        >
          {isLoading ? (
            <option>{t("reportsPage.loadingSpaces")}</option>
          ) : error ? (
            <option>{t("reportsPage.failedSpaces")}</option>
          ) : (
            <>
              <option value="">{t("reportsPage.allSpaces")}</option>

              {normalizedSpaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </div>
  );
}

export default ReportsToolbar
