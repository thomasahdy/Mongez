import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import Badge from "../ui/Badge";
import NavItem from "./NavItem";
import NavSection from "./NavSection";
import ToggleLanguage from "./ToggleLanguage";
import TreeLink from "./TreeLink";
import SpaceSwitcher from "../spaces/SpaceSwitcher";
import { logout } from "../../services/api/authService";
import { useAppContext } from "../../pages/AppContext";

const OVERVIEW_LINKS = [
  { href: "/my-work", icon: "fa-circle-check", label: "My Work", badge: { label: "5", variant: "danger" } },
  { href: "/approvals", icon: "fa-stamp", label: "Approvals" },
  { href: "/inbox", icon: "fa-inbox", label: "Inbox", badge: { label: "3", variant: "danger" } },
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
  const { activeSpace, activeBoard, boardsByDepartment } = useAppContext();
  const closeMobile = () => onCloseMobile?.();
  const activeBoardTableRoute = activeBoard?.id ? `/board/${activeBoard.id}/table` : "";

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <aside
      className="workspace-sidebar flex h-screen w-[260px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-700 dark:bg-slate-800 [scrollbar-width:none]"
      aria-label="Sidebar navigation"
    >
      <div className="flex justify-around">
        <div className="flex items-center gap-2.5 px-2 py-1 mb-5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500 shrink-0">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M8 22V10l5 8 5-8v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="24" cy="10" r="2" fill="#a5b4fc" />
            </svg>
          </div>
          <NavLink to="/" className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {t("mongez")}
          </NavLink>
        </div>
        {setLanguage ? <ToggleLanguage setLanguage={setLanguage} language={language} /> : null}
      </div>

      <div className="mb-4">
        <SpaceSwitcher />
      </div>

      <NavSection label={t("overview")}>
        {OVERVIEW_LINKS.map((item) => (
          <NavItem key={item.label} {...item} onClick={closeMobile} />
        ))}
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
            <Badge variant="neutral" className="ml-auto">
              {activeSpace.role}
            </Badge>
          ) : null}
        </NavLink>

        <div className="ml-2.5 border-l border-slate-200 pl-3 dark:border-slate-700">
          {boardsByDepartment.length ? (
            boardsByDepartment.map((department) => (
              <div key={department.id || department.name}>
                <TreeLink
                  label={department.name || "Department"}
                  to="/spaces"
                  active={department.id === activeBoard?.departmentId}
                  badge={department.boards.length ? String(department.boards.length) : ""}
                  onClick={closeMobile}
                />
                {department.boards.length > 0 ? (
                  <div className="ml-2 border-l border-slate-200 pl-3 dark:border-slate-700">
                    {department.boards.slice(0, 4).map((board) => (
                      <TreeLink
                        key={board.id}
                        label={board.name || "Board"}
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
            <TreeLink label="Create or select a space" to="/spaces" onClick={closeMobile} />
          )}
        </div>

        {activeBoardTableRoute ? (
          <NavItem href={activeBoardTableRoute} icon="fa-table-cells" label="Active Board Table" onClick={closeMobile} />
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
          className="w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-[13px] font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-150 text-left cursor-pointer"
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
