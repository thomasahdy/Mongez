import React from 'react';
import Skeleton from '../ui/Skeleton';

export default function TaskBoardSkeleton() {
  return (
    <div className="flex-1 overflow-x-auto px-6 py-4">
      {/* Simulation of Kanban columns layout */}
      <div className="flex gap-5 h-full min-w-max">
        {[1, 2, 3, 4].map((colIndex) => (
          <div key={colIndex} className="w-[280px] bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-3 flex flex-col gap-3 shrink-0 border border-slate-100 dark:border-slate-800/40">
            {/* Column Header */}
            <div className="flex justify-between items-center mb-1">
              <Skeleton className="h-5 w-24 bg-slate-200 dark:bg-slate-800" />
              <Skeleton className="h-4 w-7 rounded-md bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Simulated Cards */}
            <div className="flex flex-col gap-3 overflow-y-auto">
              {[1, 2, 3].map((cardIndex) => (
                <div
                  key={cardIndex}
                  className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-3"
                >
                  {/* Task Tags */}
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-12 rounded bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {/* Task Title */}
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-full bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  {/* Bottom divider line */}
                  <div className="h-px bg-slate-100 dark:bg-slate-900" />

                  {/* Avatars and due date */}
                  <div className="flex justify-between items-center pt-0.5">
                    <Skeleton className="h-5 w-16 bg-slate-200 dark:bg-slate-800" />
                    <Skeleton className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
