export default function CalendarFiltersPanel({
  draftFilters,
  invalidEventCount,
  isRTL,
  onApplyFilters,
  onClearFilters,
  onUpdateDraftFilters,
  onUseActiveWorkspace,
  preferences,
  t,
  children,
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr_180px_auto]">
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.filters.spaceId")}</label>
          <input
            value={draftFilters.spaceId}
            onChange={(event) => onUpdateDraftFilters((current) => ({ ...current, spaceId: event.target.value }))}
            placeholder={t("calendar.filters.workspaceScope")}
            className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white ${isRTL ? "text-right" : "text-left"}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.filters.boardId")}</label>
          <input
            value={draftFilters.boardId}
            onChange={(event) => onUpdateDraftFilters((current) => ({ ...current, boardId: event.target.value }))}
            placeholder={t("calendar.filters.optionalBoardScope")}
            className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white ${isRTL ? "text-right" : "text-left"}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("calendar.filters.holidayCountry")}</label>
          <input
            value={draftFilters.holidayCountry}
            onChange={(event) => onUpdateDraftFilters((current) => ({ ...current, holidayCountry: event.target.value.toUpperCase() }))}
            placeholder={preferences?.holidayCountry || ""}
            className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] uppercase text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white ${isRTL ? "text-right" : "text-left"}`}
          />
        </div>
        <div className={`flex items-end gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <button
            type="button"
            onClick={onApplyFilters}
            className="rounded-2xl bg-sky-500 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-sky-600"
          >
            {t("calendar.filters.apply")}
          </button>
          <button
            type="button"
            onClick={onUseActiveWorkspace}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
          >
            {t("calendar.filters.useActive")}
          </button>
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
          >
            {t("calendar.filters.reset")}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-500">
        {t("calendar.notices.nonWorking")}
      </div>

      {invalidEventCount > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
          {invalidEventCount === 1
            ? t("calendar.notices.invalidEntries", { count: invalidEventCount })
            : t("calendar.notices.invalidEntriesPlural", { count: invalidEventCount })}
        </div>
      ) : null}

      {children}
    </div>
  );
}
