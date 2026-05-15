import React from 'react'
import Badge from '../ui/Badge';
import NavItem from './NavItem';
import NavSection from './NavSection';
import TreeLink from './TreeLink';

const OVERVIEW_LINKS = [
  { href: "#my-work",      icon: "fa-circle-check",       label: "My Work",     badge: { label: "5", variant: "danger" } },
  { href: "#inbox",        icon: "fa-inbox",              label: "Inbox",        badge: { label: "3", variant: "danger" } },
  { href: "#dashboard",    icon: "fa-chart-pie",          label: "Dashboard" },
  { href: "#search",       icon: "fa-magnifying-glass",   label: "Search",       kbd: "⌘K" },
  { href: "#ai-assistant", icon: "fa-sparkles",           label: "AI Assistant", iconColor: "#6366f1", aiBadge: true },
];

const VIEW_LINKS = [
  { href: "#calendar", icon: "fa-regular fa-calendar", label: "Calendar", badge: { label: "2 mtgs", variant: "neutral" } },
  { href: "#timeline", icon: "fa-bars-staggered",       label: "Timeline" },
  { href: "#whiteboard",icon: "fa-chalkboard",          label: "Whiteboard" },
  { href: "#reports",  icon: "fa-chart-line",           label: "Reports" },
];

const Sidebar = () => {
  return (
    <aside
      className="w-[260px] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col px-3 py-4 overflow-y-auto h-screen [scrollbar-width:none]"
      aria-label="Sidebar navigation"
    >
      {/* Brand */}
      <a href="#" className="flex items-center gap-2.5 px-2 py-1 mb-5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500 shrink-0">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M8 22V10l5 8 5-8v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="10" r="2" fill="#a5b4fc" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight text-slate-800 dark:text-slate-100">Mongez</span>
      </a>

      {/* Overview */}
      <NavSection label="Overview">
        {OVERVIEW_LINKS.map((item) => <NavItem key={item.label} {...item} />)}
      </NavSection>

      {/* Views */}
      <NavSection label="Views">
        {VIEW_LINKS.map((item) => <NavItem key={item.label} {...item} />)}
      </NavSection>

      {/* Spaces */}
      <NavSection label="Spaces" actionHref="#spaces">
        {/* Education dept */}
        <div className="px-2 py-[7px] rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center gap-2 text-[13px] font-medium text-slate-800 dark:text-slate-200 mb-1">
          <span className="w-5 flex justify-center"><i className="fa-solid fa-graduation-cap text-red-500" /></span>
          <span>Education Dept</span>
          <Badge variant="neutral" className="ml-auto">Head</Badge>
        </div>
        {/* Tree */}
        <div className="pl-3 ml-2.5 border-l border-slate-200 dark:border-slate-700">
          <TreeLink label="Upper Egypt Edu" active badge="3" hasAI />
          <div className="pl-3 ml-2 border-l border-slate-200 dark:border-slate-700">
            <TreeLink label="Curriculum Board" dotColor="#00a8e8" />
            <TreeLink label="Procurement" />
          </div>
          <TreeLink label="Cairo Literacy Program" badge="1" />
        </div>

        {/* Other depts */}
        <NavItem href="#health" icon="fa-hospital" iconColor="#3498db" label="Health Dept" badge={{ label: "2", variant: "neutral" }} />
        <NavItem href="#ops" icon="fa-gears" iconColor="#f39c12" label="Operations"
          badge={{ label: "5", variant: "neutral" }}
        />

        <a href="#spaces" className="flex items-center gap-2 px-2 py-[7px] mt-1.5 text-[13px] font-medium text-slate-400 opacity-60 hover:opacity-100 hover:text-sky-500 transition-all duration-150 rounded-lg">
          <span className="w-5 flex justify-center"><i className="fa-solid fa-plus" /></span>
          Manage Spaces
        </a>
      </NavSection>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
        <NavItem href="settings.html" icon="fa-gear" label="Settings" />
        <a href="login.html" className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[13px] font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-150">
          <span className="w-5 flex justify-center"><i className="fa-solid fa-arrow-right-from-bracket" /></span>
          Log out
        </a>
      </div>
    </aside>
  )
}


export default Sidebar
