import { useTranslation } from "react-i18next";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import ChartCard from '../../components/reports/ChartCard';
import AreaTooltip from '../../components/reports/AreaToolTip';
import { useCumulativeFlow } from "../../hooks/api/useAnalytics";

const CumulativeFlowChart = ({ spaceId, period }) => {
  const { t } = useTranslation();
  const { data: flowData = [] } = useCumulativeFlow(spaceId, period);

  return (
    <ChartCard title={t("reportsPage.cumulativeFlow")}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={flowData}>
          <defs>
            <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradProgress" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00a8e8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00a8e8" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradTodo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<AreaTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area type="monotone" dataKey="todo"     name={t("reportsPage.todo")}      stroke="#f59e0b" fill="url(#gradTodo)"     strokeWidth={2} />
          <Area type="monotone" dataKey="progress" name={t("reportsPage.inProgress")} stroke="#00a8e8" fill="url(#gradProgress)" strokeWidth={2} />
          <Area type="monotone" dataKey="done"     name={t("reportsPage.done")}       stroke="#10b981" fill="url(#gradDone)"     strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default CumulativeFlowChart
