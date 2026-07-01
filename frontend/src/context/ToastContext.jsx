import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useLocaleDirection } from "../hooks/useLocaleDirection";
import i18n from "../i18n";

const ToastContext = createContext(null);

let toastIdCounter = 0;

const TOAST_MESSAGE_KEYS = {
  "Please sign in to access this page.": "toasts.authRequired",
  "Your session has expired. Please sign in again.": "toasts.sessionExpired",
  "An unexpected error occurred.": "toasts.unexpectedError",
};

function translateToastMessage(message) {
  if (typeof message === "string") {
    const key = TOAST_MESSAGE_KEYS[message] || (i18n.exists(message) ? message : null);
    return key ? i18n.t(key) : message;
  }

  if (Array.isArray(message)) {
    return message.map(translateToastMessage).join(", ");
  }

  if (message && typeof message === "object") {
    if (message.key) {
      return i18n.t(message.key, message.values);
    }

    if (message.message) {
      return translateToastMessage(message.message);
    }

    return JSON.stringify(message);
  }

  return String(message);
}

// ── Bridge for non-React code (axios interceptors, queryClient) ──
// These are set by ToastProvider on mount so imperative code can fire toasts.
let _bridgeShowToast = null;

export function showToastBridge(message, type = "error", duration) {
  if (_bridgeShowToast) {
    _bridgeShowToast(message, type, duration);
  } else {
    // Fallback if provider hasn't mounted yet
    console.error(`[Toast:${type}]`, translateToastMessage(message));
  }
}

// ── Icon per type ──
const ICONS = {
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const COLORS = {
  success: {
    border: 'border-emerald-500',
    icon: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  error: {
    border: 'border-red-500',
    icon: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
  },
  warning: {
    border: 'border-amber-500',
    icon: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
  info: {
    border: 'border-sky-500',
    icon: 'text-sky-500',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
  },
};

// ── Provider ──
export function ToastProvider({ children }) {
  const { isRTL } = useLocaleDirection();
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = 'success', duration = 5000) => {
      const safeMessage = translateToastMessage(message);
      const id = `toast-${++toastIdCounter}`;
      setToasts((prev) => [...prev.slice(-4), { id, message: safeMessage, type }]); // Keep max 5

      timersRef.current[id] = setTimeout(() => removeToast(id), duration);
      return id;
    },
    [removeToast],
  );

  // Register the bridge so non-React code can fire toasts
  _bridgeShowToast = showToast;

  const contextValue = {
    /** Show a toast. Returns the toast ID for manual dismissal. */
    show: showToast,
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* ── Toast Container ── */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-label={i18n.t("toasts.notifications")}
          className={`fixed bottom-6 z-[9999] flex w-full max-w-sm flex-col gap-3 pointer-events-none ${isRTL ? "left-6" : "right-6"}`}
          dir={isRTL ? "rtl" : "ltr"}
        >
          {toasts.map((t) => {
            const color = COLORS[t.type] || COLORS.info;
            return (
              <div
                key={t.id}
                role="alert"
                className={`
                  pointer-events-auto flex items-start gap-3 p-4
                  bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800
                  ${isRTL ? "border-r-4 flex-row-reverse text-right animate-[slideInLeft_0.3s_ease-out]" : "border-l-4 animate-[slideInRight_0.3s_ease-out]"} ${color.border}
                  rounded-xl shadow-lg
                `}
              >
                <span className={color.icon}>{ICONS[t.type] || ICONS.info}</span>
                <p className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug" dir="auto">
                  {t.message}
                </p>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  aria-label={i18n.t("toasts.dismiss")}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ── Hook ──
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

export default ToastContext;
