import { useState, useMemo, useCallback, useRef } from "react";
import Button from '../../components/ui/Button'
import HighlightedText from "../../components/ui/HighlightedText";
import NoResults from "./NoResults";
import ResultIconBadge from "../../components/search/ResultIconBadge";
import ResultTag from "../../components/search/ResultTag";
import AIAnswerCard from "../../components/search/AIAnswerCard";
import ResultFilterTabs from "./sections/ResultFilterTabs";
import SearchBar from "./sections/SearchBar";
import SuggestionChips from "./sections/SuggestionChips";
import SearchHero from "./sections/SearchHero";
import ResultItem from "../../components/search/ResultItem";
import ViewTabs from "../home/viewtabs/ViewTabs";

// ─────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────


const RESULT_FILTER_TABS = [
  { id: "all",      label: "All",      count: 8 },
  { id: "tasks",    label: "Tasks",    count: 4 },
  { id: "files",    label: "Files",    count: 2 },
  { id: "people",   label: "People",   count: 1 },
  { id: "comments", label: "Comments", count: 1 },
];

/** All result items — type drives filter tab */
const ALL_RESULTS = [
  {
    id: "r1",
    type: "tasks",
    iconBg:    "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600",
    icon:      "fa-pause",
    title:     "Funding Release — Tranche 2",
    description:
      "Stuck at Central Bank since Oct 15, 2024 (23 days). External dependency. Blocked status.",
    tags: ["Waiting", "Upper Egypt Edu", "Omar M."],
  },
  {
    id: "r2",
    type: "tasks",
    iconBg:    "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-500",
    icon:      "fa-spinner",
    title:     "Finalize Budget Allocation for Q1 2025",
    description:
      "Depends on funding release. 90% complete. Assigned to Nour. Due Oct 18.",
    tags: ["In Progress", "Finance"],
  },
  {
    id: "r3",
    type: "tasks",
    iconBg:    "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-500",
    icon:      "fa-file-lines",
    title:     "Q4 Impact Assessment Report",
    description:
      "Funding data required for donor reporting. 30% complete, 2 days overdue.",
    tags: ["To Do", "Donors"],
  },
  {
    id: "r4",
    type: "tasks",
    iconBg:    "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600",
    icon:      "fa-triangle-exclamation",
    title:     "Submit Curriculum Approval Doc",
    description:
      "Ministry deadline overdue. Funding confirmation needed for budget section.",
    tags: ["To Do", "Min. of Edu"],
  },
  {
    id: "r5",
    type: "files",
    iconBg:    "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-700",
    icon:      "fa-file-pdf",
    title:     "Funding_Agreement_T2_2024.pdf",
    description:
      "Original agreement for Tranche 2 funding. Uploaded by Ahmed H. on Sep 28.",
    tags: ["PDF · 2.4 MB", "Contracts"],
  },
  {
    id: "r6",
    type: "files",
    iconBg:    "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-700",
    icon:      "fa-file-excel",
    title:     "Budget_Projection_With_Funding.xlsx",
    description:
      "Financial projections assuming Tranche 2 release. Last modified Oct 10.",
    tags: ["XLSX · 840 KB", "Finance"],
  },
  {
    id: "r7",
    type: "people",
    iconBg:    "bg-slate-100 dark:bg-slate-700",
    iconColor: "text-slate-500",
    icon:      "fa-user",
    title:     "Omar Mostafa (OM)",
    description:
      "Assigned to Funding Release — Tranche 2. Finance Dept. Contact for bank liaison.",
    tags: ["Team Member", "Finance"],
  },
  {
    id: "r8",
    type: "comments",
    iconBg:    "bg-yellow-100 dark:bg-yellow-900/30",
    iconColor: "text-yellow-700",
    icon:      "fa-regular fa-comment",
    title:     "Comment by Omar M. on Funding Release",
    description:
      '"Called the bank again today. They say it\'s in final committee review. Expected within 2 weeks."',
    tags: ["Oct 12", "Upper Egypt Edu"],
  },
];

const AI_ANSWER = {
  text: [
    { bold: false, value: "" },
    { bold: true,  value: "Funding Release — Tranche 2" },
    { bold: false, value: " has been blocked at Central Bank for " },
    { bold: true,  value: "23 days" },
    { bold: false, value: " (since Oct 15). This is longer than " },
    { bold: true,  value: "89%" },
    { bold: false, value: " of similar cases. It affects 3 downstream tasks including Teacher Training Workshop and Budget Allocation. AI recommends escalation to Dept Head." },
  ],
  sources: [
    { icon: "fa-list-check", label: "Task: Funding Release" },
    { icon: "fa-regular fa-comment", label: "7 comments" },
    { icon: "fa-chart-bar",  label: "12 similar cases" },
  ],
};

const VIEW_TABS_DATA = [
  { id: "board",    href: "#board",    icon: "fa-table-columns", label: "Board" },
  { id: "list",     href: "#list",     icon: "fa-list",          label: "List" },
  { id: "calendar", href: "#calendar", icon: "fa-calendar",      label: "Calendar" },
  { id: "gantt",    href: "#gantt",    icon: "fa-bars-staggered", label: "Gantt" },
  { id: "table",    href: "#table",    icon: "fa-table-cells",   label: "Table" },
];




export default function SearchPage({ initialQuery = "" }) {
  const [query,       setQuery]       = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery); // committed query (on Enter)
  const [activeFilter, setActiveFilter] = useState("all");

  const hasResults = Boolean(activeQuery.trim());

  // Filter results by type tab
  const filteredResults = useMemo(() => {
    if (activeFilter === "all") return ALL_RESULTS;
    return ALL_RESULTS.filter((r) => r.type === activeFilter);
  }, [activeFilter]);

  const handleSearch = useCallback((q) => {
    if (!q.trim()) return;
    setActiveQuery(q);
    setActiveFilter("all");
  }, []);

  const handleQueryChange = useCallback((val) => {
    setQuery(val);
    // Clear results immediately when input is cleared
    if (!val.trim()) setActiveQuery("");
  }, []);

  return (
    <>

      
          <ViewTabs />

          {/* Scrollable content area */}
          <main
            className="flex-1 overflow-y-auto"
            aria-label={hasResults ? `Search results for "${activeQuery}"` : "Search"}
          >
            {!hasResults ? (
              /* ── EMPTY STATE ── */
              <SearchHero
                query={query}
                onQueryChange={handleQueryChange}
                onSearch={handleSearch}
              />
            ) : (
              /* ── RESULTS STATE ── */
              <div className="px-6 py-6 max-w-[820px] mx-auto">

                {/* AI Answer */}
                <AIAnswerCard answer={AI_ANSWER} />

                {/* Filter tabs */}
                <ResultFilterTabs
                  tabs={RESULT_FILTER_TABS}
                  activeId={activeFilter}
                  onChange={setActiveFilter}
                />

                {/* Results or empty */}
                {filteredResults.length === 0 ? (
                  <NoResults query={activeQuery} />
                ) : (
                  <div
                    className="flex flex-col gap-2"
                    role="list"
                    aria-label={`${filteredResults.length} search results`}
                  >
                    {filteredResults.map((result) => (
                      <ResultItem key={result.id} result={result} query={activeQuery} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        
    </>
  );
}