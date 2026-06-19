import React from 'react'
import PriorityBar from '../../components/reports/PriorityBar';
import ChartCard from '../../components/reports/ChartCard';

const PriorityBreakdown = ({ priorities }) => {
  return (
    <ChartCard title="Tasks by Priority">
      <div className="flex flex-col gap-5">
        {priorities.map((p) => (
          <PriorityBar key={p.label} item={p} />
        ))}
      </div>
    </ChartCard>
  );
}

export default PriorityBreakdown
