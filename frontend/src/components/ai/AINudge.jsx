import React, { useEffect, useState } from 'react'

const AINudge = ({ onYes, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  
    useEffect(() => {
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }, []);
  
    if (!visible) return null;
  
    return (
      <div
        className={`fixed bottom-[88px] right-6 w-[340px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-3.5 z-[200] transition-all duration-400 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        role="alert"
        aria-live="polite"
      >
        <div className="flex gap-2.5 items-start mb-3">
          <i className="fa-solid fa-robot text-indigo-500 text-[16px] mt-0.5" />
          <p className="flex-1 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong className="text-slate-800 dark:text-slate-100">Hey Thomas</strong> — Funding Release has been blocked 5 days longer than usual. Want me to draft an escalation email?
          </p>
          <button
            onClick={() => { setVisible(false); onDismiss?.(); }}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            aria-label="Dismiss AI nudge"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => { setVisible(false); onYes?.(); }}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
          >
            Yes, draft it
          </button>
          <button onClick={() => setVisible(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Remind me tomorrow
          </button>
          <button onClick={() => setVisible(false)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Not now
          </button>
        </div>
      </div>
    );
}

export default AINudge
