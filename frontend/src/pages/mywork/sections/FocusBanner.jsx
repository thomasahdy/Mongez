import React from 'react'
import Button from '../../../components/ui/Button';

const FocusBanner = ({ criticalTask, onFocusStart }) => {
  return (
    <div
      className="bg-gradient-to-r from-indigo-500 to-sky-500 rounded-xl px-6 py-5 flex items-center justify-between gap-4 mb-6"
      role="region"
      aria-label="Focus Mode"
    >
      <div>
        <h3 className="text-[16px] font-bold text-white flex items-center gap-2 mb-1">
          <i className="fa-solid fa-crosshairs" aria-hidden="true" />
          Focus Mode
        </h3>
        <p className="text-[13px] text-white/85 leading-relaxed">
          Your most critical task:{" "}
          <strong className="text-white">{criticalTask.name}</strong>
          {criticalTask.due && ` — due ${criticalTask.due}`}
        </p>
      </div>
      <Button variant="focus-white" size="md" onClick={onFocusStart} className="shrink-0">
        <i className="fa-solid fa-play text-[11px]" aria-hidden="true" />
        Start Focus
      </Button>
    </div>
  );
}

export default FocusBanner
