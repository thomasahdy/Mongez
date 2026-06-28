import React from "react";
import { useTranslation } from "react-i18next";
import OwnerBadge from "../../components/ui/OwnerBadge";
import StatItem from "../../components/ui/StatItem";
import Button from "../../components/ui/Button";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const SpaceCardHeader = ({ space, expanded, onToggle, onInvite, onSettings, onMore }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();

  return (
    <div
      className="flex cursor-pointer items-center justify-between border-b border-slate-200 px-6 py-5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-750"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={t("spacesPage.toggleSpace", { name: space.name })}
      onKeyDown={(event) => event.key === "Enter" && onToggle()}
    >
      <div className="flex items-center gap-3.5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[15px] font-bold text-white ${space.gradient}`}>
          {space.initials}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-1 text-[17px] font-bold leading-tight text-slate-800 dark:text-slate-100">
            {space.name}
            {space.isOwner ? <OwnerBadge /> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-[12px]">
            <StatItem icon="fa-building" label={t("spacesPage.departmentCount", { count: space.stats.departments })} />
            <StatItem icon="fa-table-columns" label={t("spacesPage.boardCount", { count: space.stats.boards })} />
            <StatItem icon="fa-users" label={t("spacesPage.memberCount", { count: space.stats.members })} />
          </div>
        </div>
      </div>

      <div className={`flex shrink-0 items-center gap-2 ${isRTL ? "mr-4" : "ml-4"}`} onClick={(event) => event.stopPropagation()}>
        <Button variant="outline" size="md" onClick={onInvite} aria-label={t("spacesPage.inviteMembersTo", { name: space.name })}>
          <i className="fa-solid fa-user-plus text-sky-500" /> <span className="hidden sm:inline">{t("spacesPage.invite")}</span>
        </Button>

        <Button variant="outline" size="md" onClick={onSettings} aria-label={t("spacesPage.editSettingsFor", { name: space.name })} title={t("spacesPage.workspaceSettings")}>
          <i className="fa-solid fa-gear text-slate-500 dark:text-slate-400" />
        </Button>

        {space.isOwner || space.role === "OWNER" || space.role === "ADMIN" ? (
          <Button
            variant="outline"
            size="md"
            onClick={onMore}
            aria-label={t("spacesPage.deleteSpaceAria", { name: space.name })}
            title={t("spacesPage.deleteSpace")}
            className="hover:!bg-red-50 hover:!text-red-600 dark:hover:!bg-red-950/20"
          >
            <i className="fa-solid fa-trash-can text-red-500" />
          </Button>
        ) : null}

        <i
          className={`fa-solid fa-chevron-down text-[12px] text-slate-400 transition-transform duration-200 ${isRTL ? "mr-1.5" : "ml-1.5"} ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default SpaceCardHeader;
