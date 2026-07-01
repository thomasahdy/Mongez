import { useMemo } from "react";
import { useTranslation } from "react-i18next";

function preprocessMessageContent(text) {
  if (!text) {
    return "";
  }

  let cleanText = text.trim();

  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7).trim();
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3).trim();
  }

  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3).trim();
  }

  if (cleanText.startsWith("{") && cleanText.endsWith("}")) {
    try {
      const parsed = JSON.parse(cleanText);
      if (parsed && typeof parsed.answer === "string") {
        return parsed.answer;
      }
    } catch {
      // Ignore malformed JSON-like content.
    }
  }

  if (cleanText.includes('"answer"')) {
    try {
      const startBrace = cleanText.indexOf("{");
      const endBrace = cleanText.lastIndexOf("}");
      if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
        const jsonSub = cleanText.substring(startBrace, endBrace + 1);
        const parsed = JSON.parse(jsonSub);
        if (parsed && typeof parsed.answer === "string") {
          return parsed.answer;
        }
      }
    } catch {
      // Ignore malformed JSON-like content.
    }
  }

  return text;
}

function MarkdownRenderer({ content }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir(i18n.language) === "rtl";
  const processedText = useMemo(() => preprocessMessageContent(content), [content]);

  const formatInline = (text) => {
    if (!text) {
      return "";
    }

    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-extrabold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={index}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-indigo-500 dark:bg-slate-800 dark:text-indigo-400"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      if (part.startsWith("[") && part.includes("](")) {
        const closeBracket = part.indexOf("]");
        const label = part.slice(1, closeBracket);
        const url = part.slice(closeBracket + 2, -1);

        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-indigo-650 underline transition-colors hover:text-indigo-750 dark:text-indigo-450 dark:hover:text-indigo-300"
          >
            {label}
          </a>
        );
      }

      return part;
    });
  };

  const blocks = useMemo(() => {
    if (!processedText) {
      return [];
    }

    const rawLines = processedText.split(/\r?\n/);
    const resolvedBlocks = [];
    let currentBlock = null;

    for (let index = 0; index < rawLines.length; index += 1) {
      const line = rawLines[index];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("```")) {
        if (currentBlock && currentBlock.type === "code") {
          resolvedBlocks.push(currentBlock);
          currentBlock = null;
        } else {
          if (currentBlock) {
            resolvedBlocks.push(currentBlock);
          }
          currentBlock = { type: "code", language: trimmedLine.slice(3).trim(), lines: [] };
        }
        continue;
      }

      if (currentBlock && currentBlock.type === "code") {
        currentBlock.lines.push(line);
        continue;
      }

      if (trimmedLine.startsWith("|")) {
        if (currentBlock && currentBlock.type === "table") {
          currentBlock.lines.push(line);
        } else {
          if (currentBlock) {
            resolvedBlocks.push(currentBlock);
          }
          currentBlock = { type: "table", lines: [line] };
        }
        continue;
      }

      if (currentBlock && currentBlock.type === "table") {
        resolvedBlocks.push(currentBlock);
        currentBlock = null;
      }

      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ") || /^\d+\.\s/.test(trimmedLine)) {
        const isNumbered = /^\d+\.\s/.test(trimmedLine);
        const listText = isNumbered ? trimmedLine.replace(/^\d+\.\s/, "") : trimmedLine.slice(2);

        if (currentBlock && currentBlock.type === "list" && currentBlock.numbered === isNumbered) {
          currentBlock.items.push(listText);
        } else {
          if (currentBlock) {
            resolvedBlocks.push(currentBlock);
          }
          currentBlock = { type: "list", numbered: isNumbered, items: [listText] };
        }
        continue;
      }

      if (currentBlock && currentBlock.type === "list") {
        resolvedBlocks.push(currentBlock);
        currentBlock = null;
      }

      if (trimmedLine.startsWith("#")) {
        if (currentBlock) {
          resolvedBlocks.push(currentBlock);
        }
        const match = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          resolvedBlocks.push({ type: "heading", level: match[1].length, text: match[2] });
          currentBlock = null;
          continue;
        }
      }

      if (trimmedLine === "") {
        if (currentBlock) {
          resolvedBlocks.push(currentBlock);
          currentBlock = null;
        }
      } else if (currentBlock && currentBlock.type === "paragraph") {
        currentBlock.text += `\n${line}`;
      } else {
        if (currentBlock) {
          resolvedBlocks.push(currentBlock);
        }
        currentBlock = { type: "paragraph", text: line };
      }
    }

    if (currentBlock) {
      resolvedBlocks.push(currentBlock);
    }

    return resolvedBlocks;
  }, [processedText]);

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        switch (block.type) {
          case "heading": {
            const level = Math.min(3, block.level);
            const text = block.text.trim();

            let icon = null;
            if (text.toLowerCase().includes("executive summary") || text.toLowerCase().includes("summary")) {
              icon = <i className={`fa-solid fa-robot shrink-0 text-indigo-500 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("insights") || text.toLowerCase().includes("metrics")) {
              icon = <i className={`fa-solid fa-chart-line shrink-0 text-emerald-500 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("risks") || text.toLowerCase().includes("blockers")) {
              icon = <i className={`fa-solid fa-triangle-exclamation shrink-0 text-rose-500 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("actions") || text.toLowerCase().includes("reminders")) {
              icon = <i className={`fa-solid fa-circle-play shrink-0 text-amber-500 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("sources") || text.toLowerCase().includes("citations")) {
              icon = <i className={`fa-solid fa-folder-open shrink-0 text-sky-500 ${isRTL ? "ml-2" : "mr-2"}`} />;
            }

            const headingClasses = {
              1: "text-md mt-3 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1 font-extrabold text-slate-800 dark:border-slate-800 dark:text-slate-100",
              2: "text-sm mt-2.5 mb-1.5 flex items-center gap-1.5 font-bold text-slate-805 dark:text-slate-150",
              3: "mt-2 mb-1 flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800 dark:text-slate-200",
            };
            const Tag = `h${level}`;

            return (
              <Tag key={blockIndex} className={headingClasses[level]}>
                {icon}
                {formatInline(text)}
              </Tag>
            );
          }

          case "list": {
            const ListTag = block.numbered ? "ol" : "ul";
            return (
              <ListTag
                key={blockIndex}
                className={`${isRTL ? "pr-5 text-right" : "pl-5 text-left"} mb-2.5 space-y-1 ${block.numbered ? "list-decimal" : "list-disc"}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="leading-relaxed text-slate-705 dark:text-slate-300">
                    {formatInline(item)}
                  </li>
                ))}
              </ListTag>
            );
          }

          case "code":
            return (
              <pre
                key={blockIndex}
                className="my-2.5 overflow-x-auto rounded-2xl border border-slate-850 bg-slate-950 p-3.5 font-mono text-[11.5px] leading-relaxed text-slate-200 shadow-inner"
              >
                <code>{block.lines.join("\n")}</code>
              </pre>
            );

          case "table": {
            const rows = block.lines
              .map((line) => line.split("|").map((cell) => cell.trim()).filter((_, index, arr) => index > 0 && index < arr.length - 1))
              .filter((row) => row.length > 0);

            if (rows.length === 0) {
              return null;
            }

            const hasSeparator = rows.length > 1 && rows[1].every((cell) => /^:-*-:|^:-*-|^ -*:-*|^-+$/.test(cell));
            const headers = rows[0];
            const dataRows = hasSeparator ? rows.slice(2) : rows.slice(1);

            return (
              <div key={blockIndex} className="my-3 overflow-x-auto rounded-2xl border border-slate-150 shadow-sm dark:border-slate-800/80">
                <table className={`w-full border-collapse bg-white text-[12px] dark:bg-slate-900 ${isRTL ? "text-right" : "text-left"}`}>
                  <thead>
                    <tr className="border-b border-slate-150 bg-slate-50 dark:border-slate-800/80 dark:bg-slate-850/50">
                      {headers.map((header, headerIndex) => (
                        <th key={headerIndex} className="px-3.5 py-2.5 font-bold tracking-wider text-slate-800 dark:text-slate-200">
                          {formatInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-808/40">
                    {dataRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-850/20">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3.5 py-2.5 leading-relaxed text-slate-655 dark:text-slate-350">
                            {formatInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          case "paragraph":
          default:
            return (
              <p key={blockIndex} className="mb-2 whitespace-pre-line leading-relaxed text-slate-750 dark:text-slate-300">
                {formatInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

export function ChatBubble({
  message,
  feedbackState,
  onFeedback,
  onRetry,
  onActionDecision,
  reviewingActionId,
}) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith("ar");
  const isFailedStep = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();
    return normalizedStatus.startsWith("âœ—") || normalizedStatus.includes("failed") || normalizedStatus.includes("error");
  };

  if (message.kind === "welcome") {
    return (
      <div className="p-2 text-[13.5px] font-medium leading-relaxed text-slate-700 dark:text-slate-300" dir="auto">
        <MarkdownRenderer content={message.text} />
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div
        className={`rounded-[22px] bg-gradient-to-tr from-indigo-600 to-indigo-500 px-5 py-3 text-[13.5px] font-semibold leading-relaxed whitespace-pre-wrap text-white shadow-md shadow-indigo-500/10 ${
          isRTL ? "rounded-tl-sm" : "rounded-tr-sm"
        }`}
        dir="auto"
      >
        {message.text}
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="space-y-4 rounded-3xl border border-slate-150 bg-white p-5 shadow-sm dark:border-slate-808 dark:bg-slate-900" dir="auto">
        {message.label ? (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <i className={`fa-solid ${message.icon || "fa-sparkles"} text-rose-500`} />
            <span>{message.label}</span>
          </div>
        ) : null}
        <div
          className={`animate-pulse rounded-2xl border border-rose-100/50 bg-rose-50/50 px-4 py-3 dark:border-rose-900/30 dark:bg-rose-955/10 ${
            isRTL ? "flex flex-row-reverse items-center justify-between gap-3 text-right" : "flex items-center justify-between gap-3"
          }`}
        >
          <span className="text-[12.5px] font-bold leading-relaxed text-rose-605 dark:text-rose-455">
            {message.error}
          </span>
          <button
            type="button"
            onClick={() => onRetry?.(message.id)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500 px-3.5 py-1 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-rose-600"
          >
            <i className="fa-solid fa-arrows-rotate" />
            {t("aiAssistant.labels.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (message.loading) {
    return (
      <div className="space-y-3.5 p-2 text-[13px] leading-relaxed text-slate-750 dark:text-slate-300" dir="auto">
        <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
          <div className="flex shrink-0 items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
          </div>
          <span className="animate-pulse text-[12.5px] font-bold tracking-wide">
            {message.status || t("aiAssistant.labels.thinking")}
          </span>
        </div>

        {message.thinkingSteps?.length > 0 ? (
          <div className={`space-y-2.5 py-1 ${isRTL ? "border-r-2 border-slate-100 pr-4 dark:border-slate-800" : "border-l-2 border-slate-100 pl-4 dark:border-slate-800"}`}>
            {message.thinkingSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-2.5 text-[11.5px] font-bold">
                {step.active ? (
                  <i className="fa-solid fa-circle-notch fa-spin shrink-0 text-[10px] text-indigo-500" />
                ) : isFailedStep(step.status) ? (
                  <i className="fa-solid fa-circle-xmark shrink-0 text-[10px] text-rose-500" />
                ) : (
                  <i className="fa-solid fa-circle-check shrink-0 text-[10px] text-emerald-500" />
                )}
                <span className={step.active ? "text-slate-805 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const hasActions = message.actions && message.actions.length > 0;

  return (
    <div className="space-y-3.5">
      <div
        className={`text-[13.5px] leading-relaxed ${
          hasActions
            ? "rounded-3xl border border-slate-150 bg-white p-6 shadow-sm dark:border-slate-808 dark:bg-slate-900"
            : "p-2 font-normal text-slate-755 dark:text-slate-200"
        }`}
        dir="auto"
      >
        {hasActions && message.label ? (
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <i className={`fa-solid ${message.icon || "fa-sparkles"} text-indigo-500`} />
            <span>{message.label}</span>
          </div>
        ) : null}

        <MarkdownRenderer content={message.text} />

        {hasActions ? (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-808/40">
            <span className="mb-2.5 block text-[10px] font-bold uppercase tracking-wider text-slate-450 dark:text-slate-500">
              {t("aiAssistant.labels.chat.suggestedActionTasks")}
            </span>
            <div className="grid grid-cols-1 gap-2.5">
              {message.actions.map((action, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border border-slate-150/60 bg-slate-50 p-3.5 shadow-sm dark:border-slate-808 dark:bg-slate-955 ${
                    isRTL ? "flex flex-col gap-3 text-right md:flex-row-reverse md:items-center md:justify-between" : "flex flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-655 dark:bg-indigo-950/40 dark:text-indigo-400">
                      {action.commandType || action.type || t("aiAssistant.labels.chat.actionFallback")}
                    </span>
                    <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-slate-808 dark:text-slate-255">
                      {action.reason || action.description}
                    </p>
                  </div>
                  <div className="flex w-full shrink-0 gap-2 md:w-auto">
                    <button
                      type="button"
                      disabled={reviewingActionId === (action.id || action.actionId)}
                      onClick={() => onActionDecision?.(action.id || action.actionId, "approve")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-55 md:flex-none"
                    >
                      <i className="fa-solid fa-check" /> {t("aiAssistant.labels.actions.approve")}
                    </button>
                    <button
                      type="button"
                      disabled={reviewingActionId === (action.id || action.actionId)}
                      onClick={() => onActionDecision?.(action.id || action.actionId, "reject")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white px-3.5 py-1.5 text-[11px] font-bold text-rose-605 transition hover:bg-rose-50 disabled:opacity-55 dark:bg-slate-900 dark:text-rose-455 dark:hover:bg-rose-955/20 md:flex-none"
                    >
                      <i className="fa-solid fa-xmark" /> {t("aiAssistant.labels.actions.reject")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {message.traceId ? (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <button
            type="button"
            disabled={feedbackState?.submitting}
            onClick={() => onFeedback(message.traceId, "positive")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              feedbackState?.rating === "positive"
                ? "border-emerald-205 bg-emerald-50/80 text-emerald-700 dark:bg-emerald-955/20 dark:text-emerald-455"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-808 dark:border-slate-808 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <i className={`fa-solid ${feedbackState?.submitting ? "fa-spinner fa-spin" : "fa-thumbs-up"}`} />
            {t("aiAssistant.labels.feedback.helpful")}
          </button>
          <button
            type="button"
            disabled={feedbackState?.submitting}
            onClick={() => onFeedback(message.traceId, "negative")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              feedbackState?.rating === "negative"
                ? "border-amber-205 bg-amber-55/80 text-amber-750 dark:bg-amber-955/20 dark:text-amber-455"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-808 dark:border-slate-808 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <i className="fa-solid fa-thumbs-down" />
            {t("aiAssistant.labels.feedback.needsWork")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ToastContainer({ toasts, onClose }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir(i18n.language) === "rtl";

  return (
    <div
      aria-live="polite"
      aria-label={t("toasts.notifications")}
      className={`pointer-events-none fixed bottom-5 z-55 flex max-w-sm flex-col gap-2.5 ${isRTL ? "left-5" : "right-5"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md animate-slideIn ${
            isRTL ? "flex-row-reverse text-right" : ""
          } ${
            toast.type === "success"
              ? "border-emerald-100 bg-emerald-55/90 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/90"
              : toast.type === "error"
                ? "border-rose-100 bg-rose-55/90 text-rose-900 dark:border-rose-900 dark:bg-rose-950/90"
                : toast.type === "info"
                  ? "border-sky-100 bg-sky-55/90 text-sky-900 dark:border-sky-900 dark:bg-sky-950/90"
                  : "border-slate-200 bg-white/90 text-slate-850 dark:border-slate-800 dark:bg-slate-900/90"
          }`}
        >
          <i
            className={`fa-solid ${
              toast.type === "success"
                ? "fa-circle-check text-emerald-500"
                : toast.type === "error"
                  ? "fa-circle-xmark text-rose-500"
              : "fa-circle-info text-sky-550"
            }`}
          />
          <span className="flex-1 text-[12px] font-bold leading-5" dir="auto">{toast.message}</span>
          <button
            type="button"
            onClick={() => onClose(toast.id)}
            className={`${isRTL ? "mr-auto" : "ml-auto"} flex h-5 w-5 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-650`}
            aria-label={t("toasts.dismiss")}
          >
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        </div>
      ))}
    </div>
  );
}
