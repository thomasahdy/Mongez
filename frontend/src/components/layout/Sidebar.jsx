import { useMemo } from "react";
import { NavLink, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import Badge from "../ui/Badge";
import NavItem from "./NavItem";
import NavSection from "./NavSection";
import TreeLink from "./TreeLink";
import ToggleLanguage from "./ToggleLanguage";
import { useAppContext } from "../../pages/AppContext";
import { authService } from "../../services/auth.service";
import mongezWordmark from "../../assets/Mongez.svg";
import mongezMark from "../../assets/MongezMLogo.svg";

const OVERVIEW_LINKS = [
  { href: "/my-work", icon: "fa-circle-check", label: "My Work" },
  { href: "/inbox", icon: "fa-inbox", label: "Inbox" },
  { href: "/dashboard", icon: "fa-chart-pie", label: "Dashboard" },
  { href: "/search", icon: "fa-magnifying-glass", label: "Search", kbd: "Ctrl K" },
  { href: "/ai-assistant", icon: "fa-sparkles", label: "AI Assistant", iconColor: "#6366f1", aiBadge: true },
];

const Sidebar = ({ setLanguage, language, onCloseMobile }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { activeSpace, activeDepartments, activeBoards, activeBoard } = useAppContext();

  const closeMobile = () => {
    onCloseMobile?.();
  };

  const boardsByDepartment = useMemo(() => {
    return activeDepartments.map((department) => ({
      ...department,
      boards: activeBoards.filter((board) => board.departmentId === department.id),
    }));
  }, [activeBoards, activeDepartments]);

  const routeBoardId = location.pathname.match(/^\/board\/([^/]+)/)?.[1] || "";
  const currentBoardId = routeBoardId || activeBoard?.id || activeBoards[0]?.id || "";
  const timelineRoute = currentBoardId ? `/board/${currentBoardId}/timeline` : "/spaces";
  const activeBoardTableRoute = currentBoardId ? `/board/${currentBoardId}/table` : "";

  const viewLinks = [
    { href: "/calendar", icon: "fa-regular fa-calendar", label: "Calendar" },
    { href: timelineRoute, icon: "fa-bars-staggered", label: "Timeline" },
    { href: "/whiteboard", icon: "fa-chalkboard", label: "Whiteboard" },
    { href: "/reports", icon: "fa-chart-line", label: "Reports" },
  ];

  const handleLogout = async () => {
    await authService.logout();
    window.location.href = "/login";
  };

  return (
    <aside
      className="workspace-sidebar flex h-screen w-[260px] flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 dark:border-slate-700 dark:bg-slate-800 [scrollbar-width:none]"
      aria-label="Sidebar navigation"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <NavLink
          to="/dashboard"
          onClick={closeMobile}
          className="flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <span className="flex items-center gap-0 text-slate-900">
          <div className="grid h-10 w-10 place-items-center rounded-xl">
            <img src={mongezMark} alt="Mongez mark" className="h-9 w-8 object-contain" />
          </div>
          <img src={mongezWordmark} alt="Mongez" className="h-11 w-auto object-contain" />
          </span>
        </NavLink>
        <ToggleLanguage setLanguage={setLanguage} language={language} />
      </div>

      <NavSection label={t("overview")}>
        {OVERVIEW_LINKS.map((item) => (
          <NavItem key={item.label} {...item} onClick={closeMobile} />
        ))}
      </NavSection>

      <NavSection label={t("views")}>
        {viewLinks.map((item) => (
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
          {activeSpace?.role && (
            <Badge variant="neutral" className="ml-auto">
              {activeSpace.role}
            </Badge>
          )}
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
                {department.boards.length > 0 && (
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
                )}
              </div>
            ))
          ) : (
            <TreeLink label="Create or select a space" to="/spaces" onClick={closeMobile} />
          )}
        </div>

        {activeBoardTableRoute && (
          <NavItem href={activeBoardTableRoute} icon="fa-table-cells" label="Active Board Table" onClick={closeMobile} />
        )}

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

      <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-700">
        <NavItem href="/settings" icon="fa-gear" label={t("settings")} onClick={closeMobile} />
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-[7px] text-[13px] font-medium text-red-400 transition-all duration-150 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
        >
          <span className="flex w-5 justify-center">
            <i className="fa-solid fa-arrow-right-from-bracket" />
          </span>
          {t("logout")}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
