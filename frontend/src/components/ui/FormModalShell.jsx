import { useTranslation } from "react-i18next";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function FormModalShell({
  title,
  titleId = "modal-title",
  closeLabel,
  onClose,
  children,
  maxWidthClass = "max-w-md",
}) {
  const { t } = useTranslation();
  const { dir, isRTL } = useLocaleDirection();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      dir={dir}
    >
      <div className={`relative w-full ${maxWidthClass} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fadeIn dark:border-slate-800 dark:bg-slate-950 ${isRTL ? "text-right" : "text-left"}`}>
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 to-indigo-500" />

        <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-4 pt-6 dark:border-slate-900">
          <h2 id={titleId} className="text-[18px] font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            aria-label={closeLabel || t("common.close")}
          >
            <i className="fa-solid fa-xmark text-[16px]" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

export function ModalActionRow({ children }) {
  const { isRTL } = useLocaleDirection();

  return (
    <div className={`flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-900 ${isRTL ? "flex-row-reverse" : ""}`}>
      {children}
    </div>
  );
}
