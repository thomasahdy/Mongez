import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSpaces, useSetActiveSpace } from "../../hooks/api/useSpaces";
import SpaceSwitcherSkeleton from "./SpaceSwitcherSkeleton";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { useAppContext } from "../../pages/AppContext";
import { readActiveSpaceId, writeActiveSpaceId } from "../../utils/appStorageKeys";

export default function SpaceSwitcher() {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { data, isLoading } = useSpaces();
  const { mutate: selectSpace } = useSetActiveSpace();
  const { activeSpace, activeSpaceId, setActiveSpace } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const spaces = data?.spaces || [];

  useEffect(() => {
    if (data) {
      const spacesList = data.spaces || [];
      const savedActiveId = readActiveSpaceId();
      const apiActiveId = data.activeSpaceId;
      const activeId = savedActiveId || apiActiveId || spacesList[0]?.id;
      const active = spacesList.find((space) => space.id === activeId) || spacesList[0];
      if (!active) return;
      if (active.id !== activeSpaceId) {
        setActiveSpace(active.id);
      }

      if (active && active.id !== savedActiveId) {
        writeActiveSpaceId(active.id);
      }
    }
  }, [activeSpaceId, data, setActiveSpace]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSpaceSelect = (space) => {
    if (space.id === activeSpace?.id) {
      setIsOpen(false);
      return;
    }

    selectSpace(space.id, {
      onSuccess: () => {
        setActiveSpace(space.id);
        setIsOpen(false);
        window.location.reload();
      },
    });
  };

  if (isLoading) {
    return <SpaceSwitcherSkeleton />;
  }

  return (
    <div className="relative w-full" ref={dropdownRef} dir={isRTL ? "rtl" : "ltr"} data-tour="workspace-switcher">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none transition-all dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 hover:bg-slate-100 cursor-pointer ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
      >
        {activeSpace?.logo ? (
          <img src={activeSpace.logo} alt="" className="h-6 w-6 rounded-md object-cover" />
        ) : (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-xs font-bold text-white dark:bg-indigo-600">
            {activeSpace?.name ? activeSpace.name.charAt(0).toUpperCase() : "M"}
          </div>
        )}

        <span className="flex-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
          {activeSpace?.name || t("spaceSwitcher.selectWorkspace")}
        </span>

        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${isOpen ? "rotate-180" : ""
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute inset-x-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl animate-slideDown dark:border-slate-800 dark:bg-slate-950">
          {spaces.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-400">{t("spaceSwitcher.noSpaces")}</div>
          ) : (
            spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                onClick={() => handleSpaceSelect(space)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors cursor-pointer ${isRTL ? "flex-row-reverse text-right" : "text-left"
                  } ${space.id === activeSpace?.id
                    ? "bg-indigo-50/50 font-semibold text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                  }`}
              >
                {space.logo ? (
                  <img src={space.logo} alt="" className="h-5.5 w-5.5 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-xxs font-bold text-white">
                    {space.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{space.name}</div>
                  {space.memberCount !== undefined ? (
                    <div className="text-xxs text-slate-400 dark:text-slate-500">
                      {t("spaceSwitcher.memberCount", { count: space.memberCount })}
                    </div>
                  ) : null}
                </div>
                {space.id === activeSpace?.id ? (
                  <svg className="h-4 w-4 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
