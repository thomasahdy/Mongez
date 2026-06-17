import React from 'react'
import ChartCard from '../../components/reports/ChartCard'
import Button from '../../components/ui/Button'
import PerformerRow from '../../components/reports/PerformerRow'

const TopPerformersList = ({ performers }) => {
  return (
    <ChartCard title="Top Performers">
      <div role="list" aria-label="Top performers by tasks completed">
        {performers.map((p, i) => (
          <div key={p.id} role="listitem">
            <PerformerRow performer={p} rank={i} />
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="md"
        className="w-full justify-center mt-4"
        aria-label="View full team list"
      >
        View Full Team List
      </Button>
    </ChartCard>
  )
}

export default TopPerformersList
