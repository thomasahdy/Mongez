import { useMemo } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import BrandLogo from "../branding/BrandLogo";
import Badge from "../ui/Badge";
import NavItem from "./NavItem";
import NavSection from "./NavSection";
import ToggleLanguage from "./ToggleLanguage";
import TreeLink from "./TreeLink";
import SpaceSwitcher from "../spaces/SpaceSwitcher";
import { logout } from "../../services/api/authService";
import { useAppContext } from "../../pages/AppContext";
import { useUnreadNotificationCount } from "../../hooks/api/notifications/useNotifications";
import { useMyWorkTasks } from "../../hooks/api/useTasks";

const OVERVIEW_LINKS = [
  { href: "/my-work", icon: "fa-circle-check", label: "My Work" },
  { href: "/approvals", icon: "fa-stamp", label: "Approvals" },
  { href: "/inbox", icon: "fa-inbox", label: "Inbox" },
  { href: "/dashboard", icon: "fa-chart-pie", label: "Dashboard" },
  { href: "/search", icon: "fa-magnifying-glass", label: "Search", kbd: "Ctrl K" },
  { href: "/ai-assistant", icon: "fa-sparkles", label: "AI Assistant", aiBadge: true },
];

const VIEW_LINKS = [
  { href: "/calendar", icon: "fa-regular fa-calendar", label: "Calendar", badge: { label: "2 mtgs", variant: "neutral" } },
  { href: "/workflows", icon: "fa-route", label: "Workflows" },
  { href: "/timeline", icon: "fa-bars-staggered", label: "Timeline" },
  { href: "/whiteboard", icon: "fa-chalkboard", label: "Whiteboard" },
  { href: "/reports", icon: "fa-chart-line", label: "Reports" },
];

const Sidebar = ({ onCloseMobile, setLanguage, language }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { activeSpace, activeBoard, boardsByDepartment } = useAppContext();
  const closeMobile = () => onCloseMobile?.();
  const activeBoardTableRoute = activeBoard?.id ? `/board/${activeBoard.id}/table` : "";

  const spaceId = activeSpace?.id || "";
  const { data: countData } = useUnreadNotificationCount(spaceId);
  const unreadCount = countData?.unread ?? 0;

  const { data: myWorkTasks } = useMyWorkTasks();
  const myWorkCount = useMemo(() => {
    if (!myWorkTasks) return 0;
    const overdueCount = myWorkTasks.overdue?.length || 0;
    const todayCount = myWorkTasks.today?.length || 0;
    const upcomingCount = myWorkTasks.upcoming?.length || 0;
    const noDueDateCount = myWorkTasks.noDueDate?.length || 0;
    return overdueCount + todayCount + upcomingCount + noDueDateCount;
  }, [myWorkTasks]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <aside
      data-tour="primary-navigation"
      className={`workspace-sidebar flex h-screen w-[260px] flex-col overflow-y-auto bg-white px-3 py-4 dark:bg-slate-800 [scrollbar-width:none] ${isRTL ? "border-l border-slate-200 dark:border-slate-700" : "border-r border-slate-200 dark:border-slate-700"}`}
      aria-label={t("layout.sidebarAria")}
    >
      <div className="flex justify-around p-3">
        <BrandLogo
          to="/dashboard"
          ariaLabelKey="landing.nav.homeAria"
          markWrapperClassName="flex h-10 w-10 items-center justify-center rounded-xl"
          markClassName="h-12 w-12 object-contain"
          wordmarkClassName="h-10 w-auto object-contain"
        />
        {setLanguage ? <ToggleLanguage setLanguage={setLanguage} language={language} /> : null}
      </div>

      <div className="mb-4">
        <SpaceSwitcher />
      </div>

      <NavSection label={t("overview")}>
        {OVERVIEW_LINKS.map((item) => {
          let badge = null;
          if (item.href === "/inbox" && unreadCount > 0) {
            badge = { label: String(unreadCount), variant: "danger" };
          } else if (item.href === "/my-work" && myWorkCount > 0) {
            badge = { label: String(myWorkCount), variant: "danger" };
          }
          return (
            <NavItem
              key={item.label}
              {...item}
              badge={badge}
              onClick={closeMobile}
            />
          );
        })}
      </NavSection>

      <NavSection label={t("views")}>
        {VIEW_LINKS.map((item) => (
          <NavItem key={item.label} {...item} onClick={closeMobile} />
        ))}
      </NavSection>

      <NavSection label={t("spaces")} actionTo="/spaces">
        <NavLink
          to="/spaces"
          onClick={closeMobile}
          className="mb-1 flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-[7px] text-[13px] font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200"
        >
          <span className="flex w-5 justify-center">
            <i className="fa-solid fa-layer-group text-sky-500" />
          </span>
          <span className="min-w-0 flex-1 truncate">{activeSpace?.name || t("manage spaces")}</span>
          {activeSpace?.role ? (
            <Badge variant="neutral" className={isRTL ? "mr-auto" : "ml-auto"}>
              {activeSpace.role}
            </Badge>
          ) : null}
        </NavLink>

        <div className={`${isRTL ? "mr-2.5 border-r pr-3" : "ml-2.5 border-l pl-3"} border-slate-200 dark:border-slate-700`}>
          {boardsByDepartment.length ? (
            boardsByDepartment.map((department) => (
              <div key={department.id || department.name}>
                <TreeLink
                  label={department.name || t("Department")}
                  to="/spaces"
                  active={department.id === activeBoard?.departmentId}
                  badge={department.boards.length ? String(department.boards.length) : ""}
                  onClick={closeMobile}
                />
                {department.boards.length > 0 ? (
                  <div className={`${isRTL ? "mr-2 border-r pr-3" : "ml-2 border-l pl-3"} border-slate-200 dark:border-slate-700`}>
                    {department.boards.slice(0, 4).map((board) => (
                      <TreeLink
                        key={board.id}
                        label={board.name || t("Board")}
                        to={`/board/${board.id}/table`}
                        active={board.id === activeBoard?.id}
                        dotColor={board.color || "#00a8e8"}
                        onClick={closeMobile}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <TreeLink label={t("layout.createOrSelectSpace")} to="/spaces" onClick={closeMobile} />
          )}
        </div>

        {activeBoardTableRoute ? (
          <NavItem href={activeBoardTableRoute} icon="fa-table-cells" label={t("layout.activeBoardTable")} onClick={closeMobile} />
        ) : null}

        <NavLink
          to="/spaces"
          onClick={closeMobile}
          className="mt-1.5 flex items-center gap-2 rounded-lg px-2 py-[7px] text-[13px] font-medium text-slate-400 opacity-60 transition-all duration-150 hover:text-sky-500 hover:opacity-100"
        >
          <span className="flex w-5 justify-center">
            <i className="fa-solid fa-plus" />
          </span>
          {t("manage spaces")}
        </NavLink>
      </NavSection>

      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
        <NavItem href="/settings" icon="fa-gear" label={t("settings")} />
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-[13px] font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-150 cursor-pointer ${isRTL ? "text-right" : "text-left"}`}
        >
          <span className="w-5 flex justify-center">
            <i className="fa-solid fa-arrow-right-from-bracket" />
          </span>
          {t("logout")}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
