import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReportsToolbar from "./ReportsToolbar";
import AIInsightsPanel from "./AIInsightsPanel";
import TaskVolumeChart from "./TaskVolumeChart";
import TopPerformersList from "./TopPerformersList";
import PriorityBreakdown from "./PriorityBreakdown";
import CumulativeFlowChart from "./CumulativeFlowChart";
import StatsSection from "./StatsSection";
import useLocaleDirection from "../../hooks/useLocaleDirection";

// ─────────────────────────────────────────────
// CONSTANTS / DATA
// ─────────────────────────────────────────────

const TOP_PERFORMERS = [
  { id: "sm", name: "Sarah Miller", initials: "SM", color: "#10b981", tasks: 124 },
  { id: "tu", name: "Thomas User",  initials: "TH", color: "#00a8e8", tasks: 98 },
  { id: "mr", name: "Marcus Reed",  initials: "MR", color: "#e74c3c", tasks: 86 },
  { id: "ed", name: "Emma Davis",   initials: "ED", color: "#f39c12", tasks: 72 },
];

const FLOW_DATA = [
  { day: "Apr 1", todo: 40, progress: 20, done: 10 },
  { day: "Apr 7", todo: 55, progress: 25, done: 18 },
  { day: "Apr 14", todo: 35, progress: 40, done: 30 },
  { day: "Apr 21", todo: 50, progress: 30, done: 45 },
  { day: "Apr 28", todo: 30, progress: 50, done: 60 },
  { day: "May 5",  todo: 20, progress: 35, done: 80 },
];

const ReportsPage = ({setPath}) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const [selectedSpace, setSelectedSpace] = useState({});
  


  const [insights] = useState([{
    id: "velocity",
    icon: "fa-arrow-trend-up",
    iconColor: "text-sky-500",
    title: "Velocity Increased",
    description:
      'The team completed 24% more tasks this month compared to last month. "Website Redesign" was the most active project.',
  },
  {
    id: "bottleneck",
    icon: "fa-triangle-exclamation",
    iconColor: "text-amber-500",
    title: "Bottleneck Detected",
    description:
      'Tasks in the "Design Review" column are averaging 4.2 days to resolution, which is 2× slower than the workspace average.',
  },])
  useEffect(()=>{
      setPath([
        {
          name: selectedSpace?.name || t("common.workspace"),
          color:"text-slate-400",
          ref:""
        },
        {
          name: t("reportsPage.breadcrumb"),
          color:"text-slate-800",
          ref:""
        },
      ])
    }, [selectedSpace?.name, setPath, t]);


  return (


      <div className={`flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans ${isRtl ? "text-right" : "text-left"}`} dir={dir}>
        
        
        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          

          {/* Scrollable body */}
          <main className="flex-1 overflow-y-auto" aria-label={t("reportsPage.aria")}>
            <div className="px-6 py-6 max-w-[1400px] mx-auto">

              {/* Page title */}
              <div className="flex items-end justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50 mb-1.5">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-[14px] text-slate-500 dark:text-slate-400 max-w-xl">
                    {t("reportsPage.description", {
                      workspace: selectedSpace?.name || t("common.workspace"),
                    })}
                  </p>
                </div>
              </div>

              {/* Toolbar */}
              <ReportsToolbar selectedSpace={selectedSpace} setSelectedSpace={setSelectedSpace}/>

              {/* AI Insights */}
              <AIInsightsPanel insights={insights} />

              {/* KPI metrics */}
              <StatsSection spaceId={selectedSpace.id} />

              {/* Charts row 1: bar chart (2/3) + top performers (1/3) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                  <TaskVolumeChart spaceId={selectedSpace.id}/>
                </div>
                <TopPerformersList performers={TOP_PERFORMERS} />
              </div>

              {/* Charts row 2: priority breakdown (1/2) + cumulative flow (1/2) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                <PriorityBreakdown spaceId={selectedSpace.id} />
                <CumulativeFlowChart data={FLOW_DATA} />
              </div>

            </div>
          </main>
        </div>
      </div>
  );
}

export default ReportsPage
