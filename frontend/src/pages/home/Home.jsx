import { useState, useEffect, useCallback } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import Avatar from "../../components/Avatar";
import AISidebar from "../../components/AISidebar";
import AINudge from "../../components/AINudge";
import FAB from "../../components/FAB";
import KanbanBoard from "../kanbanboard/KanbanBoard";
import Toolbar from "./toolbar/Toolbar";
import ViewTabs from "./viewtabs/ViewTabs";


// ─────────────────────────────────────────────
// DESIGN TOKENS (mirrors CSS custom-props)
// ─────────────────────────────────────────────
const STATUS_COLORS = {
  todo:     { dot: "#94a3b8", bg: "#f1f5f9", text: "#475569", label: "To Do" },
  waiting:  { dot: "#ea580c", bg: "#fff7ed", text: "#ea580c", label: "Waiting" },
  progress: { dot: "#00a8e8", bg: "#e8f7fd", text: "#0077b6", label: "In Progress" },
  review:   { dot: "#6366f1", bg: "#eef0ff", text: "#6366f1", label: "In Review" },
  done:     { dot: "#10b981", bg: "#ecfdf5", text: "#10b981", label: "Done & Signed" },
};

const BOARD_COLUMNS = [
  {
    id: "todo",
    label: "To Do",
    icon: "fa-regular fa-circle",
    metrics: "Ready to start",
    count: 5,
    countVariant: "neutral",
    cards: [
      {
        progress: 80,
        tags: [{ label: "Budget Risk", variant: "risk" }, { label: "Min. of Edu", variant: "ext" }],
        title: "Submit Curriculum Approval Doc",
        avatars: [{ initials: "AH", color: "#3b82f6" }],
        extraAvatars: 2,
        dueLabel: "Due Yesterday",
        dueVariant: "danger",
        comments: 3,
      },
      {
        tags: [{ label: "Internal", variant: "int" }],
        title: "Review Staff Allocations",
        avatars: [{ initials: "S", color: "#8b5cf6" }],
        dueLabel: "Oct 15",
      },
      {
        progress: 30,
        tags: [{ label: "Donor", variant: "ext" }, { label: "Overdue", variant: "risk" }],
        title: "Prepare Q4 Impact Assessment Report",
        avatars: [{ initials: "KH", color: "#f97316" }],
        extraAvatars: 1,
        dueLabel: "2d overdue",
        dueVariant: "danger",
        comments: 7,
      },
      {
        tags: [{ label: "Internal", variant: "int" }],
        title: "Update Emergency Contact List",
        avatars: [{ initials: "N", color: "#14b8a6" }],
        dueLabel: "Oct 20",
      },
      {
        tags: [{ label: "Gov", variant: "ext" }],
        title: "File Annual Compliance Report",
        avatars: [{ initials: "FA", color: "#6366f1" }],
        extraAvatars: 3,
        dueLabel: "Oct 28",
        comments: 1,
      },
    ],
  },
  {
    id: "waiting",
    label: "Waiting",
    icon: "fa-solid fa-pause",
    iconColor: "#ea580c",
    metrics: "External approvals",
    metricsExtra: "Longer than usual",
    count: 3,
    countVariant: "waiting",
    cards: [
      {
        tags: [{ label: "External Dependency", variant: "ext" }],
        title: "Funding Release - Tranche 2",
        leftBorder: "#ea580c",
        blocker: {
          stuck: "Stuck at Central Bank",
          since: "Oct 15, 2024",
          days: 23,
          expected: "Nov 15",
          confidence: 85,
          cases: 12,
          avgDays: 22,
        },
        avatars: [{ initials: "OM", color: "#64748b" }],
        dueLabel: "Blocked",
        dueVariant: "danger",
      },
      {
        tags: [{ label: "Gov Approval", variant: "ext" }],
        title: "Ministry Permit for Rural Schools",
        leftBorder: "#f59e0b",
        avatars: [{ initials: "L", color: "#ec4899" }],
        dueLabel: "8 days",
        dueVariant: "warning",
        comments: 2,
      },
      {
        tags: [{ label: "Internal", variant: "int" }],
        title: "Vendor Quote — Printing Services",
        avatars: [{ initials: "YS", color: "#0ea5e9" }],
        dueLabel: "Awaiting 3 quotes",
      },
    ],
  },
  {
    id: "progress",
    label: "In Progress",
    icon: "fa-solid fa-spinner",
    iconColor: "#00a8e8",
    metrics: "Currently active",
    count: 4,
    countVariant: "primary",
    cards: [
      {
        progress: 65,
        tags: [{ label: "Donor", variant: "ext" }],
        title: "Design Teacher Training Workshop",
        avatars: [{ initials: "AH", color: "#3b82f6" }, { initials: "S", color: "#8b5cf6" }],
        extraAvatars: 1,
        dueLabel: "Oct 22",
        comments: 12,
      },
      {
        progress: 40,
        tags: [{ label: "High Priority", variant: "risk" }, { label: "Internal", variant: "int" }],
        title: "Migrate Student Records to New System",
        avatars: [{ initials: "KH", color: "#f97316" }],
        dueLabel: "Tomorrow",
        dueVariant: "warning",
        comments: 5,
      },
      {
        progress: 90,
        tags: [{ label: "Gov", variant: "ext" }],
        title: "Finalize Budget Allocation for Q1 2025",
        avatars: [{ initials: "N", color: "#14b8a6" }],
        dueLabel: "Oct 18",
        comments: 9,
      },
      {
        progress: 20,
        tags: [{ label: "HR", variant: "int" }],
        title: "Onboard 3 New Field Coordinators",
        avatars: [{ initials: "L", color: "#ec4899" }],
        dueLabel: "Nov 1",
        comments: 2,
      },
    ],
  },
  {
    id: "review",
    label: "In Review",
    icon: "fa-solid fa-eye",
    iconColor: "#6366f1",
    metrics: "Awaiting approval",
    count: 3,
    countVariant: "accent",
    cards: [
      {
        progress: 100,
        tags: [{ label: "Donor", variant: "ext" }, { label: "Review", variant: "review" }],
        title: "Annual Impact Report Draft",
        avatars: [{ initials: "AH", color: "#3b82f6" }, { initials: "FA", color: "#6366f1" }],
        dueLabel: "CEO Review",
        dueVariant: "accent",
        comments: 14,
      },
      {
        progress: 100,
        tags: [{ label: "Legal", variant: "legal" }],
        title: "Partnership MOU with UNICEF Egypt",
        avatars: [{ initials: "YS", color: "#0ea5e9" }],
        dueLabel: "Legal",
        dueVariant: "accent",
        comments: 6,
      },
      {
        progress: 100,
        tags: [{ label: "Gov", variant: "ext" }],
        title: "School Safety Inspection Checklist",
        avatars: [{ initials: "OM", color: "#64748b" }],
        extraAvatars: 1,
        dueLabel: "Oct 12",
        comments: 4,
      },
    ],
  },
  {
    id: "done",
    label: "Done & Signed",
    icon: "fa-solid fa-check-circle",
    iconColor: "#10b981",
    metrics: "12 this week · 89% on-time 🏆",
    done: true,
    cards: [
      {
        title: "Q3 Financial Report",
        done: true,
        doneLabel: "Approved by CEO",
        celebration: [
          '<i class="fa-solid fa-trophy" style="color:#f59e0b;margin-right:4px"></i>2 days faster than average!',
          '<i class="fa-solid fa-chart-line" style="color:#10b981;margin-right:4px"></i>Team rate: 94% (top 10%)',
        ],
      },
      { title: "Recruit Field Supervisor — Aswan",    done: true, doneLabel: "Hired & onboarded" },
      { title: "Monthly Donor Newsletter — October",  done: true, doneLabel: "Sent to 2,400 subscribers" },
      { title: "Update Health & Safety Policy",       done: true, doneLabel: "Board approved" },
    ],
  },
];

const Home = () => {
  const [activeTab, setActiveTab] = useState("board");
  const [aiOpen, setAiOpen] = useState(false);

  const toggleAI = useCallback(() => setAiOpen((v) => !v), []);

  return (
    <>
      {/* Font Awesome CDN — injected via link tag in index.html normally */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Navbar onToggleAI={toggleAI} />
          <ViewTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <Toolbar />
          <KanbanBoard columns={BOARD_COLUMNS} />
        </main>

      {/* Portals / overlays */}
      <FAB />
      <AINudge onYes={toggleAI} />
      <AISidebar open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}

export default Home
