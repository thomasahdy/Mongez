import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import BarTooltip from "../../components/reports/BarTooltip";
import ChartCard from "../../components/reports/ChartCard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";
import Button from "../../components/ui/Button";
import { useCompletion } from "../../hooks/api/useAnalytics";

const BAR_VIEW_TABS = ["week", "month"];

const TaskVolumeChart = ({ spaceId}) => {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState("week");

  const { data, isLoading, error } = useCompletion(spaceId, activeView);

  // normalize safely
  const chartData = Array.isArray(data) ? data : [];

  return (
    <ChartCard
      title={t("reportsPage.taskVolumeTitle")}
      headerRight={
        <div className="flex gap-1" role="group">
          {BAR_VIEW_TABS.map((tab) => (
            <Button
              key={tab}
              variant="outline"
              size="sm"
              active={activeView === tab}
              onClick={() => setActiveView(tab)}
            >
              {t(`reportsPage.${tab}`)}
            </Button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
          {t("reportsPage.loadingChart")}
        </div>
      ) : error ? (
        <div className="h-[260px] flex items-center justify-center text-red-500 text-sm">
          {t("reportsPage.failedChart")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

            <XAxis
              dataKey={activeView}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />

            <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />

            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />

            <Bar
              dataKey="created"
              name={t("reportsPage.created")}
              fill="#00a8e8"
              radius={[4, 4, 0, 0]}
            />

            <Bar
              dataKey="completed"
              name={t("reportsPage.completed")}
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};

export default TaskVolumeChart;
