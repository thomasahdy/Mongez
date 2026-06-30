import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const InviterCard = ({ inviter }) => {
  const { isRTL } = useLocaleDirection();

  return (
    <div
      className={`mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-700 dark:bg-slate-700/50 ${
        isRTL ? "flex-row-reverse" : ""
      }`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[12px] font-bold text-white"
        aria-hidden="true"
      >
        {inviter.initials}
      </div>

      <div className={isRTL ? "text-right" : "text-left"}>
        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{inviter.name}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{inviter.email}</p>
      </div>
    </div>
  );
};

export default InviterCard;
