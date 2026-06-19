import React, { useState } from 'react'
import BarTooltip from '../../components/reports/BarTooltip';
import ChartCard from '../../components/reports/ChartCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import Button from '../../components/ui/Button';


const BAR_VIEW_TABS = ["Weekly", "Monthly"];
const TaskVolumeChart = ({ data }) => {
  const [activeView, setActiveView] = useState("Weekly");

  return (
    <ChartCard
      title="Task Volume vs Completion"
      headerRight={
        <div className="flex gap-1" role="group" aria-label="Chart view period">
          {BAR_VIEW_TABS.map((tab) => (
            <Button
              key={tab}
              variant="outline"
              size="sm"
              active={activeView === tab}
              onClick={() => setActiveView(tab)}
              aria-pressed={activeView === tab}
            >
              {tab}
            </Button>
          ))}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap="30%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="week"
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
          <Bar dataKey="created"   name="Created"   fill="#00a8e8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export default TaskVolumeChart
