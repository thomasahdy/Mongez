import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import ReportsToolbar from "./ReportsToolbar";
import AIInsightsPanel from "./AIInsightsPanel";
import TaskVolumeChart from "./TaskVolumeChart";
import TopPerformersList from "./TopPerformersList";
import PriorityBreakdown from "./PriorityBreakdown";
import CumulativeFlowChart from "./CumulativeFlowChart";
import StatsSection from "./StatsSection";
import useLocaleDirection from "../../hooks/useLocaleDirection";

// ─────────────────────────────────────────────
const ReportsPage = ({setPath}) => {
  const { t } = useTranslation();
  const { dir, isRtl } = useLocaleDirection();
  const [selectedSpace, setSelectedSpace] = useState({});
  const [activePeriod, setActivePeriod] = useState("month");

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
              <ReportsToolbar 
                selectedSpace={selectedSpace} 
                setSelectedSpace={setSelectedSpace} 
                activePeriod={activePeriod}
                setActivePeriod={setActivePeriod} 
              />

              {/* AI Insights */}
              <AIInsightsPanel spaceId={selectedSpace.id} period={activePeriod} />

              {/* KPI metrics */}
              <StatsSection spaceId={selectedSpace.id} period={activePeriod} />

              {/* Charts row 1: bar chart (2/3) + top performers (1/3) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                  <TaskVolumeChart spaceId={selectedSpace.id} period={activePeriod} />
                </div>
                <TopPerformersList spaceId={selectedSpace.id} period={activePeriod} />
              </div>

              {/* Charts row 2: priority breakdown (1/2) + cumulative flow (1/2) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                <PriorityBreakdown spaceId={selectedSpace.id} period={activePeriod} />
                <CumulativeFlowChart spaceId={selectedSpace.id} period={activePeriod} />
              </div>
            </div>
          </main>
        </div>
      </div>
  );
}

export default ReportsPage
