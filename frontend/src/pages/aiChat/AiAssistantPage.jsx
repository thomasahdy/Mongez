import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import meetingsService from "../../services/api/meetingsService";
import {
  useAiActionReviewMutation,
  useAiDashboardQuery,
  useAiFeedbackMutation,
  useAiReportMutation,
  useAiRiskMutation,
  useAiStreamingMutation,
} from "../../hooks/useAiQueries";
import { extractTextFromPayload } from "../../utils/extractTextFromPayload";
import { useBoardTasksQuery } from "../../hooks/useTaskListQueries";
import ErrorBoundary from "../../components/ErrorBoundary";
import mongezWordmark from "../../assets/Mongez.svg";
import mongezMark from "../../assets/MongezMLogo.svg";

const STORAGE_KEYS = {
  context: "mongez.ai.context",
  sessions: "mongez.ai.sessions",
};
const MAX_COMPOSER_LENGTH = 4000;

function buildQuickPrompts(t) {
  return t("aiAssistant.quickPrompts", { returnObjects: true }).map((item, index) => ({
    ...item,
    icon: [
      "fa-triangle-exclamation",
      "fa-shield-halved",
      "fa-users",
      "fa-arrow-up-right-dots",
      "fa-file-invoice",
      "fa-eye",
    ][index],
    accentClassName: [
      "text-rose-500 bg-rose-50 dark:bg-rose-950/20",
      "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
      "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
      "text-sky-500 bg-sky-50 dark:bg-sky-950/20",
      "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
      "text-purple-500 bg-purple-50 dark:bg-purple-950/20",
    ][index],
  }));
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJsonStorage(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function saveJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures
  }
}

function truncateText(text, maxLength = 72) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
}

function extractTraceId(payload) {
  return payload?.traceId || payload?.data?.traceId || payload?.meta?.traceId || payload?.result?.traceId || "";
}

function formatApiResult(payload) {
  const extractedText = extractTextFromPayload(payload);
  if (extractedText) return extractedText;
  return JSON.stringify(payload, null, 2);
}

function createSessionSnapshot({ sessionId, messages, context, t }) {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.kind === "text");
  return {
    id: sessionId,
    title: truncateText(firstUserMessage?.text || t("aiAssistant.untitledConversation")),
    createdAt: new Date().toISOString(),
    messages,
    context,
  };
}

function getUserFriendlyErrorMessage(error, t) {
  if (!error) return t("aiAssistant.errors.workspaceUnavailable");

  // Never expose raw provider errors to users
  const rawMsg = (typeof error === "string" ? error : error.message || error.toString() || "").toLowerCase();
  if (rawMsg.includes("429") || rawMsg.includes("rate") || rawMsg.includes("too many") || rawMsg.includes("busy")) {
    return t("aiAssistant.errors.busy");
  }
  if (rawMsg.includes("error code:") || rawMsg.includes("{'status'") || rawMsg.includes("status error") || rawMsg.includes("status: 429")) {
    return t("aiAssistant.errors.workspaceUnavailable");
  }

  if (typeof error === "string") return error;
  const status = error.status || error.response?.status;
  const message = error.message || "";

  const isNetworkOrTimeout =
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("fetch") ||
    error.code === "ECONNABORTED";

  if (isNetworkOrTimeout || status === 500 || status === 502 || status === 503 || status === 504) {
    return t("aiAssistant.errors.workspaceUnavailable");
  }

  switch (status) {
    case 400: return t("aiAssistant.errors.invalidRequest");
    case 401: return t("aiAssistant.errors.sessionExpired");
    case 403: return t("aiAssistant.errors.accessDenied");
    case 404: return t("aiAssistant.errors.resourceNotFound");
    case 429: return t("aiAssistant.errors.rateLimit");
    default: return message || t("aiAssistant.errors.workspaceUnavailable");
  }
}

function FieldLabel({ children }) {
  return <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">{children}</label>;
}

function preprocessMessageContent(text) {
  if (!text) return "";
  let cleanText = text.trim();
  
  // Strip markdown block markers if LLM leaked them e.g. ```json { "answer": ... } ```
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7).trim();
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3).trim();
  }
  if (cleanText.endsWith("```")) {
    cleanText = cleanText.substring(0, cleanText.length - 3).trim();
  }

  // If it starts with { and ends with }, let's try to parse it
  if (cleanText.startsWith("{") && cleanText.endsWith("}")) {
    try {
      const parsed = JSON.parse(cleanText);
      if (parsed && typeof parsed.answer === "string") {
        return parsed.answer;
      }
    } catch (e) {
      // Not valid JSON
    }
  }

  // In case the JSON is partially leaked or starts/ends differently,
  // search for "answer": "..." using brace matching
  if (cleanText.includes('"answer"')) {
    try {
      const startBrace = cleanText.indexOf('{');
      const endBrace = cleanText.lastIndexOf('}');
      if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
        const jsonSub = cleanText.substring(startBrace, endBrace + 1);
        const parsed = JSON.parse(jsonSub);
        if (parsed && typeof parsed.answer === "string") {
          return parsed.answer;
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  
  return text;
}

const MarkdownRenderer = ({ content }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir(i18n.language) === "rtl";
  const processedText = useMemo(() => preprocessMessageContent(content), [content]);

  // Inline formatting helper
  const formatInline = (text) => {
    if (!text) return "";
    
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-extrabold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-indigo-500 dark:text-indigo-400 text-[12px]">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith("[") && part.includes("](")) {
        const closeBrack = part.indexOf("]");
        const label = part.slice(1, closeBrack);
        const url = part.slice(closeBrack + 2, -1);
        return (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:text-indigo-750 dark:text-indigo-450 dark:hover:text-indigo-300 underline font-semibold transition-colors">
            {label}
          </a>
        );
      }
      return part;
    });
  };

  // Block parsing
  const blocks = useMemo(() => {
    if (!processedText) return [];
    
    const rawLines = processedText.split(/\r?\n/);
    const resolvedBlocks = [];
    let currentBlock = null;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmedLine = line.trim();

      // Code Block parsing
      if (trimmedLine.startsWith("```")) {
        if (currentBlock && currentBlock.type === "code") {
          resolvedBlocks.push(currentBlock);
          currentBlock = null;
        } else {
          if (currentBlock) resolvedBlocks.push(currentBlock);
          currentBlock = { type: "code", language: trimmedLine.slice(3).trim(), lines: [] };
        }
        continue;
      }

      if (currentBlock && currentBlock.type === "code") {
        currentBlock.lines.push(line);
        continue;
      }

      // Table parsing
      if (trimmedLine.startsWith("|")) {
        if (currentBlock && currentBlock.type === "table") {
          currentBlock.lines.push(line);
        } else {
          if (currentBlock) resolvedBlocks.push(currentBlock);
          currentBlock = { type: "table", lines: [line] };
        }
        continue;
      } else {
        if (currentBlock && currentBlock.type === "table") {
          resolvedBlocks.push(currentBlock);
          currentBlock = null;
        }
      }

      // List parsing
      if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ") || /^\d+\.\s/.test(trimmedLine)) {
        const isNumbered = /^\d+\.\s/.test(trimmedLine);
        const listText = isNumbered ? trimmedLine.replace(/^\d+\.\s/, "") : trimmedLine.slice(2);
        
        if (currentBlock && currentBlock.type === "list" && currentBlock.numbered === isNumbered) {
          currentBlock.items.push(listText);
        } else {
          if (currentBlock) resolvedBlocks.push(currentBlock);
          currentBlock = { type: "list", numbered: isNumbered, items: [listText] };
        }
        continue;
      } else {
        if (currentBlock && currentBlock.type === "list") {
          resolvedBlocks.push(currentBlock);
          currentBlock = null;
        }
      }

      // Headings
      if (trimmedLine.startsWith("#")) {
        if (currentBlock) resolvedBlocks.push(currentBlock);
        const match = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
        if (match) {
          resolvedBlocks.push({ type: "heading", level: match[1].length, text: match[2] });
          currentBlock = null;
          continue;
        }
      }

      // Paragraph
      if (trimmedLine === "") {
        if (currentBlock) {
          resolvedBlocks.push(currentBlock);
          currentBlock = null;
        }
      } else {
        if (currentBlock && currentBlock.type === "paragraph") {
          currentBlock.text += "\n" + line;
        } else {
          if (currentBlock) resolvedBlocks.push(currentBlock);
          currentBlock = { type: "paragraph", text: line };
        }
      }
    }

    if (currentBlock) resolvedBlocks.push(currentBlock);
    return resolvedBlocks;
  }, [processedText]);

  return (
    <div className="space-y-3">
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case "heading": {
            const level = Math.min(3, block.level);
            const text = block.text.trim();
            
            let icon = null;
            if (text.toLowerCase().includes("executive summary") || text.toLowerCase().includes("summary")) {
              icon = <i className={`fa-solid fa-robot text-indigo-500 shrink-0 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("insights") || text.toLowerCase().includes("metrics")) {
              icon = <i className={`fa-solid fa-chart-line text-emerald-500 shrink-0 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("risks") || text.toLowerCase().includes("blockers")) {
              icon = <i className={`fa-solid fa-triangle-exclamation text-rose-500 shrink-0 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("actions") || text.toLowerCase().includes("reminders")) {
              icon = <i className={`fa-solid fa-circle-play text-amber-500 shrink-0 ${isRTL ? "ml-2" : "mr-2"}`} />;
            } else if (text.toLowerCase().includes("sources") || text.toLowerCase().includes("citations")) {
              icon = <i className={`fa-solid fa-folder-open text-sky-500 shrink-0 ${isRTL ? "ml-2" : "mr-2"}`} />;
            }

            const hClasses = {
              1: "text-md font-extrabold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1 mt-3 mb-2 flex items-center gap-1.5",
              2: "text-sm font-bold text-slate-805 dark:text-slate-150 mt-2.5 mb-1.5 flex items-center gap-1.5",
              3: "text-[12.5px] font-bold text-slate-800 dark:text-slate-200 mt-2 mb-1 flex items-center gap-1.5",
            };
            const Tag = `h${level}`;
            return (
              <Tag key={bIdx} className={hClasses[level]}>
                {icon}
                {formatInline(text)}
              </Tag>
            );
          }
          case "list": {
            const ListTag = block.numbered ? "ol" : "ul";
            return (
              <ListTag key={bIdx} className={`${isRTL ? "pr-5 text-right" : "pl-5 text-left"} space-y-1 mb-2.5 ${block.numbered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item, iIdx) => (
                  <li key={iIdx} className="text-slate-705 dark:text-slate-300 leading-relaxed font-medium">
                    {formatInline(item)}
                  </li>
                ))}
              </ListTag>
            );
          }
          case "code": {
            return (
              <pre key={bIdx} className="p-3.5 rounded-2xl bg-slate-950 text-slate-200 font-mono text-[11.5px] overflow-x-auto border border-slate-850 my-2.5 leading-relaxed shadow-inner">
                <code>{block.lines.join("\n")}</code>
              </pre>
            );
          }
          case "table": {
            const rows = block.lines
              .map(line => line.split("|").map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1))
              .filter(row => row.length > 0);

            if (rows.length === 0) return null;

            const hasSeparator = rows.length > 1 && rows[1].every(cell => /^:-*-:|^:-*-|^ -*:-*|^-+$/.test(cell));
            const headers = rows[0];
            const dataRows = hasSeparator ? rows.slice(2) : rows.slice(1);

            return (
              <div key={bIdx} className="overflow-x-auto border border-slate-150 dark:border-slate-800/80 rounded-2xl shadow-sm my-3">
                <table className={`w-full text-[12px] border-collapse bg-white dark:bg-slate-900 ${i18n.dir(i18n.language) === "rtl" ? "text-right" : "text-left"}`}>
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-850/50 border-b border-slate-150 dark:border-slate-800/80">
                      {headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3.5 py-2.5 font-bold text-slate-800 dark:text-slate-200 tracking-wider">
                          {formatInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-808/40">
                    {dataRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3.5 py-2.5 text-slate-655 dark:text-slate-350 leading-relaxed">
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
          default: {
            return (
              <p key={bIdx} className="text-slate-750 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-line mb-2">
                {formatInline(block.text)}
              </p>
            );
          }
        }
      })}
    </div>
  );
};

function ChatBubble({
  message,
  feedbackState,
  onFeedback,
  onRetry,
  onCitationClick,
  onActionDecision,
  reviewingActionId,
}) {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");
  const isRTL = isArabic;

  if (message.kind === "welcome") {
    return (
      <div className="text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300 p-2 font-medium" dir="auto">
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

  // 1. ERROR: Retry Card
  if (message.error) {
    return (
      <div className="rounded-3xl border border-slate-150 dark:border-slate-808 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4" dir="auto">
        {message.label && (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <i className={`fa-solid ${message.icon || "fa-sparkles"} text-rose-500`} />
            <span>{message.label}</span>
          </div>
        )}
        <div
          className={`animate-pulse rounded-2xl border border-rose-100/50 bg-rose-50/50 px-4 py-3 dark:border-rose-900/30 dark:bg-rose-955/10 ${
            isRTL ? "flex flex-row-reverse items-center justify-between gap-3 text-right" : "flex items-center justify-between gap-3"
          }`}
        >
          <span className="text-[12.5px] text-rose-605 dark:text-rose-455 font-bold leading-relaxed">⚠️ {message.error}</span>
          <button
            type="button"
            onClick={() => onRetry?.(message.id)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 px-3.5 py-1 text-[11px] font-bold text-white transition-all cursor-pointer shadow-sm"
          >
            <i className="fa-solid fa-arrows-rotate" />
            {t("aiAssistant.labels.retry")}
          </button>
        </div>
      </div>
    );
  }

  // 2. LOADING: Thinking Steps indicator
  if (message.loading) {
    return (
      <div className="text-[13px] leading-relaxed text-slate-750 dark:text-slate-300 p-2 space-y-3.5" dir="auto">
        <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
          <div className="flex gap-1 items-center shrink-0">
            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce" />
          </div>
          <span className="text-[12.5px] font-bold tracking-wide animate-pulse">
            {message.status || t("aiAssistant.labels.thinking")}
          </span>
        </div>
        {message.thinkingSteps && message.thinkingSteps.length > 0 && (
          <div className={`py-1 space-y-2.5 ${isRTL ? "border-r-2 border-slate-100 pr-4 dark:border-slate-800" : "border-l-2 border-slate-100 pl-4 dark:border-slate-800"}`}>
            {message.thinkingSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2.5 text-[11.5px] font-bold">
                {step.active ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-indigo-500 shrink-0 text-[10px]" />
                ) : step.status.startsWith("✗") || step.status.includes("Failed") ? (
                  <i className="fa-solid fa-circle-xmark text-rose-500 shrink-0 text-[10px]" />
                ) : (
                  <i className="fa-solid fa-circle-check text-emerald-500 shrink-0 text-[10px]" />
                )}
                <span className={step.active ? "text-slate-805 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const hasActions = message.actions && message.actions.length > 0;

  // 3. PLAN and CHAT layouts
  return (
    <div className="space-y-3.5">
      <div className={`text-[13.5px] leading-relaxed ${
        hasActions 
          ? "rounded-3xl border border-slate-150 dark:border-slate-808 bg-white dark:bg-slate-900 p-6 shadow-sm" 
          : "text-slate-755 dark:text-slate-200 font-normal p-2"
      }`} dir="auto">
        {hasActions && message.label && (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-4">
            <i className={`fa-solid ${message.icon || "fa-sparkles"} text-indigo-500`} />
            <span>{message.label}</span>
          </div>
        )}
        <MarkdownRenderer content={message.text} />

        {/* Suggested Actions for Plan layout */}
        {hasActions && (
          <div className="border-t border-slate-100 dark:border-slate-808/40 pt-4 mt-4">
            <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block mb-2.5">{t("aiAssistant.labels.chat.suggestedActionTasks")}</span>
            <div className="grid grid-cols-1 gap-2.5">
              {message.actions.map((act, index) => (
                <div
                  key={index}
                  className={`rounded-2xl border border-slate-150/60 bg-slate-50 p-3.5 shadow-sm dark:border-slate-808 dark:bg-slate-955 ${
                    isRTL ? "flex flex-col gap-3 text-right md:flex-row-reverse md:items-center md:justify-between" : "flex flex-col gap-3 text-left md:flex-row md:items-center md:justify-between"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 text-[9px] font-bold text-indigo-655 dark:text-indigo-400 tracking-wide uppercase">
                      {act.commandType || act.type || t("aiAssistant.labels.chat.actionFallback")}
                    </span>
                    <p className="mt-1 text-[12.5px] font-bold text-slate-808 dark:text-slate-255 leading-relaxed">{act.reason || act.description}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      disabled={reviewingActionId === (act.id || act.actionId)}
                      onClick={() => onActionDecision?.(act.id || act.actionId, "approve")}
                      className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 px-3.5 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-55 cursor-pointer shadow-sm"
                    >
                      <i className="fa-solid fa-check" /> {t("aiAssistant.labels.actions.approve")}
                    </button>
                    <button
                      type="button"
                      disabled={reviewingActionId === (act.id || act.actionId)}
                      onClick={() => onActionDecision?.(act.id || act.actionId, "reject")}
                      className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-[11px] font-bold text-rose-605 dark:text-rose-455 transition hover:bg-rose-50 dark:hover:bg-rose-955/20 disabled:opacity-55 cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark" /> {t("aiAssistant.labels.actions.reject")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Message feedback buttons */}
      {message.traceId && (
        <div className="flex flex-wrap items-center gap-2 px-2">
          <button
            type="button"
            disabled={feedbackState?.submitting}
            onClick={() => onFeedback(message.traceId, "positive")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors cursor-pointer ${
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
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors cursor-pointer ${
              feedbackState?.rating === "negative"
                ? "border-amber-205 bg-amber-55/80 text-amber-750 dark:bg-amber-955/20 dark:text-amber-455"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-808 dark:border-slate-808 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <i className="fa-solid fa-thumbs-down" />
            {t("aiAssistant.labels.feedback.needsWork")}
          </button>
        </div>
      )}
    </div>
  );
}

function ToastContainer({ toasts, onClose }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.dir(i18n.language) === "rtl";

  return (
    <div className={`fixed bottom-5 z-55 flex max-w-sm flex-col gap-2.5 pointer-events-none ${isRTL ? "left-5" : "right-5"}`}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md animate-slideIn ${
            t.type === "success"
              ? "border-emerald-100 bg-emerald-55/90 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/90"
              : t.type === "error"
                ? "border-rose-100 bg-rose-55/90 text-rose-900 dark:border-rose-900 dark:bg-rose-950/90"
                : t.type === "info"
                  ? "border-sky-100 bg-sky-55/90 text-sky-900 dark:border-sky-900 dark:bg-sky-950/90"
                  : "border-slate-200 bg-white/90 text-slate-850 dark:border-slate-800 dark:bg-slate-900/90"
          }`}
        >
          <i
            className={`fa-solid ${
              t.type === "success"
                ? "fa-circle-check text-emerald-500"
                : t.type === "error"
                  ? "fa-circle-xmark text-rose-500"
                  : "fa-circle-info text-sky-550"
            }`}
          />
          <span className="text-[12px] font-bold leading-5">{t.message}</span>
          <button
            type="button"
            onClick={() => onClose(t.id)}
            className={`${isRTL ? "mr-auto" : "ml-auto"} flex h-5 w-5 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-650 cursor-pointer`}
          >
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AiAssistantPage() {
  const { t, i18n } = useTranslation();
  const { setPath } = useOutletContext();
  const navigate = useNavigate();
  const { activeSpace, activeBoard, spaces, activeBoards, setActiveSpace, setActiveBoard, user } = useAppContext();
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const isRTL = i18n.dir(i18n.language) === "rtl";
  const formatDate = (value, options) => new Date(value).toLocaleDateString(locale, options);
  const formatTime = (value, options) => new Date(value).toLocaleTimeString(locale, options);
  const formatDateTime = (value, options) => new Date(value).toLocaleString(locale, options);
  const welcomeMessage = useMemo(
    () => ({
      id: "welcome-message",
      role: "assistant",
      kind: "welcome",
      text: t("aiAssistant.welcome"),
    }),
    [t],
  );
  const [composer, setComposer] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [headerSpaceOpen, setHeaderSpaceOpen] = useState(false);
  const [headerBoardOpen, setHeaderBoardOpen] = useState(false);
  const [spaceDropdownOpen, setSpaceDropdownOpen] = useState(false);
  const [boardDropdownOpen, setBoardDropdownOpen] = useState(false);
  const [toneDropdownOpen, setToneDropdownOpen] = useState(false);
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // overview, actions, approvals, insights, chat
  const [toasts, setToasts] = useState([]);
  
  const [contextValues, setContextValues] = useState(() => {
    const stored = readJsonStorage(STORAGE_KEYS.context, {});
    return {
      spaceId: stored.spaceId || "",
      boardId: stored.boardId || "",
      taskId: stored.taskId || "",
      commentTone: stored.commentTone || "professional",
    };
  });
  const [recentSessions, setRecentSessions] = useState(() => readJsonStorage(STORAGE_KEYS.sessions, []));
  const [currentSessionId, setCurrentSessionId] = useState(() => makeId("session"));
  const [messages, setMessages] = useState(() => [welcomeMessage]);
  const [pageError, setPageError] = useState("");
  const [activeActionKey, setActiveActionKey] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [reviewingActionId, setReviewingActionId] = useState("");
  const [messageFeedback, setMessageFeedback] = useState({});
  const [activeMeetingTranscript, setActiveMeetingTranscript] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatAbortRef = useRef(null);
  const suggestionChips = useMemo(() => t("aiAssistant.suggestionChips", { returnObjects: true }), [t]);

  const fetchAndShowTranscript = async (meetingId, title) => {
    setLoadingTranscript(true);
    setTranscriptModalOpen(true);
    setActiveMeetingTranscript({ title, text: t("aiAssistant.errors.loadingTranscript") });
    try {
      const data = await meetingsService.getTranscript(meetingId, contextValues.spaceId);
      setActiveMeetingTranscript({ title, text: data?.transcript || data || t("aiAssistant.errors.noTranscript") });
    } catch (err) {
      setActiveMeetingTranscript({ title, text: t("aiAssistant.errors.transcriptFailed", { message: err?.message || err }) });
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleCitationClick = (citation) => {
    if (citation.entity_type === "task") {
      navigate(`/tasks/${citation.entity_id}`);
    } else if (citation.entity_type === "meeting") {
      void fetchAndShowTranscript(citation.entity_id, citation.title);
    } else if (citation.entity_type === "decision") {
      setActiveTab("overview");
      showToast(t("aiAssistant.toasts.decisionSelected", { title: citation.title }), "info");
    } else if (citation.entity_type === "approval" || citation.entity_type === "workflow") {
      setActiveTab("approvals");
      showToast(t("aiAssistant.toasts.workflowSelected", { title: citation.title }), "info");
    }
  };

  const showToast = (message, type = "success") => {
    const id = makeId("toast");
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleToastClose = (id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  };

  const tasksQuery = useBoardTasksQuery(contextValues.boardId);
  const boardTasks = tasksQuery.data || [];

  const chatContext = useMemo(
    () => ({
      spaceId: contextValues.spaceId || undefined,
      boardId: contextValues.boardId || undefined,
      taskId: contextValues.taskId || undefined,
    }),
    [contextValues.boardId, contextValues.spaceId, contextValues.taskId],
  );

  const quickPromptItems = useMemo(() => buildQuickPrompts(t), [t]);

  // Primary Workspace Intelligence query
  const dashboardQuery = useAiDashboardQuery(contextValues.spaceId.trim());
  const dashboardData = dashboardQuery.data || {
    metrics: {
      openTasks: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      pendingApprovals: 0,
      staleApprovals: 0,
      highRiskProjects: 0,
      overloadedMembers: 0,
      upcomingDeadlines: 0,
      meetingActionsWaitingReview: 0,
    },
    insights: [],
    pendingActions: [],
    approvals: [],
    risks: [],
    recentDecisions: [],
    meetingIntelligence: [],
  };

  const dashboardLoading = dashboardQuery.isLoading || dashboardQuery.isFetching;

  const streamingChatMutation = useAiStreamingMutation();
  const riskMutation = useAiRiskMutation();
  const reportMutation = useAiReportMutation();
  const feedbackMutation = useAiFeedbackMutation();
  const reviewActionMutation = useAiActionReviewMutation(contextValues.spaceId.trim());

  useEffect(() => {
    setContextValues((current) => {
      const nextSpaceId = current.spaceId || activeSpace?.id || spaces[0]?.id || "";
      const nextBoardId = current.boardId || activeBoard?.id || "";

      if (nextSpaceId === current.spaceId && nextBoardId === current.boardId) {
        return current;
      }

      return {
        ...current,
        spaceId: nextSpaceId,
        boardId: nextBoardId,
      };
    });
  }, [activeSpace?.id, activeBoard?.id, spaces]);

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || t("common.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: t("aiAssistant.labels.title"), color: "text-slate-800", ref: "" },
    ]);
  }, [setPath, activeSpace?.name, t]);

  useEffect(() => {
    saveJsonStorage(STORAGE_KEYS.context, contextValues);
  }, [contextValues]);

  useEffect(() => {
    saveJsonStorage(STORAGE_KEYS.sessions, recentSessions);
  }, [recentSessions]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [composer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const persistCurrentSession = (nextMessages) => {
    const realMessages = nextMessages.filter((message) => message.kind !== "welcome");
    if (realMessages.length === 0) return;
    const snapshot = createSessionSnapshot({
      sessionId: currentSessionId,
      messages: nextMessages,
      context: contextValues,
      t,
    });
    setRecentSessions((currentSessions) => {
      const withoutCurrent = currentSessions.filter((session) => session.id !== currentSessionId);
      return [snapshot, ...withoutCurrent].slice(0, 8);
    });
  };

  const setContextValue = (field, value) => {
    setContextValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const appendAssistantResult = (label, text, options = {}) => {
    const assistantMessage = {
      id: makeId("assistant"),
      role: "assistant",
      kind: "text",
      text,
      label,
      icon: options.icon,
      error: options.error || "",
      traceId: options.traceId || "",
    };

    setMessages((currentMessages) => {
      const nextMessages = [...currentMessages, assistantMessage];
      persistCurrentSession(nextMessages);
      return nextMessages;
    });
  };

  const runChat = async (prompt) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isStreaming) return;

    if (trimmedPrompt.length > MAX_COMPOSER_LENGTH) {
      setPageError(t("aiAssistant.errors.messageLimit", { count: MAX_COMPOSER_LENGTH }));
      return;
    }

    // Validate workspace selection before calling AI
    if (!chatContext.spaceId || chatContext.spaceId.trim() === "") {
      showToast(t("aiAssistant.errors.selectWorkspace"), "error");
      return;
    }

    const userMessage = {
      id: makeId("user"),
      role: "user",
      kind: "text",
      text: trimmedPrompt,
    };
    const assistantMessageId = makeId("assistant");
    const assistantPlaceholder = {
      id: assistantMessageId,
      role: "assistant",
      kind: "text",
      text: "",
      label: t("aiAssistant.labels.chat.intelligenceResponse"),
      icon: "fa-sparkles",
      loading: true,
      status: t("aiAssistant.labels.thinking"),
      error: "",
      traceId: "",
    };

    const baseMessages = messages.filter(m => m.id !== "welcome-message");
    setMessages([...baseMessages, userMessage, assistantPlaceholder]);
    setPageError("");
    setIsStreaming(true);
    setComposer("");
    setActiveTab("chat"); // open chat tab when user submits query

    const abortController = new AbortController();
    chatAbortRef.current = abortController;

    try {
      const { text, traceId, citations, confidence, warnings, actions, summary, insights, risks } = await streamingChatMutation.mutateAsync({
        message: trimmedPrompt,
        spaceId: chatContext.spaceId,
        boardId: chatContext.boardId,
        taskId: chatContext.taskId,
        commentTone: contextValues.commentTone,
        context: [],
        signal: abortController.signal,
        onToken: (deltaText) => {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    text: `${message.text}${deltaText}`,
                  }
                : message,
            ),
          );
        },
        onStatus: (statusInfo) => {
          setMessages((currentMessages) =>
            currentMessages.map((message) => {
              if (message.id !== assistantMessageId) return message;
              
              const info = typeof statusInfo === "string" ? { status: statusInfo } : statusInfo;
              const statusText = info.status || info.message || t("aiAssistant.labels.processing");
              const steps = message.thinkingSteps || [];

              let nextSteps = [...steps];
              if (info.event === "tool_complete" || info.event === "reflection") {
                nextSteps = steps.map((s) =>
                  s.active
                    ? {
                        ...s,
                        active: false,
                        status:
                          s.status.startsWith("✓") || s.status.startsWith("✗")
                            ? s.status
                            : `✓ ${t("aiAssistant.labels.thinkingStepCompleted", { status: s.status.replace("...", "") })}`,
                      }
                    : s,
                );
                nextSteps.push({ event: info.event, status: statusText, active: false });
              } else {
                const exists = steps.some((s) => s.status === statusText);
                if (!exists) {
                  nextSteps = steps.map((s) =>
                    s.active
                      ? {
                          ...s,
                          active: false,
                          status:
                            s.status.startsWith("✓") || s.status.startsWith("✗")
                              ? s.status
                              : `✓ ${t("aiAssistant.labels.thinkingStepResolved", { status: s.status.replace("...", "") })}`,
                        }
                      : s,
                  );
                  nextSteps.push({ event: info.event || "thinking", status: statusText, active: true });
                }
              }
              
              return {
                ...message,
                status: statusText,
                thinkingSteps: nextSteps
              };
            }),
          );
        },
      });

      setMessages((currentMessages) => {
        const finalizedMessages = currentMessages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: message.text || text || t("aiAssistant.labels.completed"),
                loading: false,
                traceId: message.traceId || traceId || "",
                citations: citations || [],
                confidence: confidence !== undefined ? confidence : { score: 1.0, level: "High", reason: "Direct lookup" },
                warnings: warnings || [],
                actions: actions || [],
                summary: summary || "",
                insights: insights || [],
                risks: risks || [],
              }
            : message,
        );
        persistCurrentSession(finalizedMessages);
        return finalizedMessages;
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        setMessages((currentMessages) => {
          const abortedMessages = currentMessages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, loading: false, error: t("aiAssistant.errors.stopped") }
              : message,
          );
          persistCurrentSession(abortedMessages);
          return abortedMessages;
        });
      } else {
        const errorMessage = getUserFriendlyErrorMessage(error, t);
        setPageError(errorMessage);
        setMessages((currentMessages) => {
          const failedMessages = currentMessages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, loading: false, error: errorMessage }
              : message,
          );
          persistCurrentSession(failedMessages);
          return failedMessages;
        });
      }
    } finally {
      chatAbortRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleSubmit = () => {
    if (!composer.trim() || isStreaming) return;
    void runChat(composer);
  };

  const handleRetry = (errorMsgId) => {
    const index = messages.findIndex((m) => m.id === errorMsgId);
    if (index === -1) return;
    const lastUserMsg = [...messages.slice(0, index)].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setMessages((current) => current.filter((m) => m.id !== errorMsgId && m.id !== lastUserMsg.id));
    void runChat(lastUserMsg.text);
  };

  const triggerDirectScan = async (actionKey) => {
    setActiveActionKey(actionKey);
    setPageError("");
    setActiveTab("chat"); // redirect to chat to see the scan output

    try {
      if (actionKey === "board_risk") {
        const payload = await riskMutation.mutateAsync({
          spaceId: contextValues.spaceId.trim(),
          boardId: contextValues.boardId.trim() || undefined,
        });
        appendAssistantResult(t("aiAssistant.scans.riskLabel"), formatApiResult(payload), {
          icon: "fa-chalkboard",
          traceId: extractTraceId(payload),
        });
      }
      if (actionKey === "report") {
        const payload = await reportMutation.mutateAsync({
          spaceId: contextValues.spaceId.trim(),
          boardId: contextValues.boardId.trim() || undefined,
          reportType: "weekly",
        });
        appendAssistantResult(t("aiAssistant.scans.reportLabel"), formatApiResult(payload), {
          icon: "fa-file-lines",
          traceId: extractTraceId(payload),
        });
      }
    } catch (error) {
      setPageError(getUserFriendlyErrorMessage(error, t));
    } finally {
      setActiveActionKey("");
    }
  };

  const handleMessageFeedback = async (traceId, rating) => {
    setMessageFeedback((current) => ({
      ...current,
      [traceId]: { ...current[traceId], submitting: true },
    }));

    try {
      await feedbackMutation.mutateAsync({ traceId, rating });
      setMessageFeedback((current) => ({
        ...current,
        [traceId]: { rating, submitting: false },
      }));
      showToast(t("aiAssistant.toasts.feedbackSubmitted"), "success");
    } catch (error) {
      setPageError(getUserFriendlyErrorMessage(error, t));
      setMessageFeedback((current) => ({
        ...current,
        [traceId]: { ...current[traceId], submitting: false },
      }));
    }
  };

  const reviewFeedAction = async (actionId, decision) => {
    setReviewingActionId(actionId);
    setPageError("");

    try {
      await reviewActionMutation.mutateAsync({ actionId, decision });
      showToast(
        t(decision === "approve" ? "aiAssistant.toasts.actionReviewedApproved" : "aiAssistant.toasts.actionReviewedRejected"),
        "success",
      );
      void dashboardQuery.refetch();
    } catch (error) {
      setPageError(getUserFriendlyErrorMessage(error, t));
    } finally {
      setReviewingActionId("");
    }
  };

  const handleNewChat = () => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }
    setCurrentSessionId(makeId("session"));
    setMessages([welcomeMessage]);
    setComposer("");
    setPageError("");
    showToast(t("aiAssistant.toasts.newSession"), "info");
  };

  const loadSession = (sessionId) => {
    const session = recentSessions.find((item) => item.id === sessionId);
    if (!session) return;
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setContextValues(session.context || contextValues);
    setActiveTab("chat");
  };

  const filteredMessages = messages.filter((m) => m.kind !== "welcome");

  // Relative timestamp helper
  const relativeTime = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return t("taskDetails.defaults.justNow");
    const relativeFormatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (mins < 60) return relativeFormatter.format(-mins, "minute");
    if (hours < 24) return relativeFormatter.format(-hours, "hour");
    if (days < 7) return relativeFormatter.format(-days, "day");
    return new Date(iso).toLocaleDateString(locale);
  };

  return (
    <div
      className={`relative flex h-full w-full flex-1 overflow-hidden font-sans ${isRTL ? "flex-row-reverse" : ""}`}
      style={{background:'var(--bg-depth-0)'}}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {historyOpen && activeTab === "chat" && (
        <aside className={`flex h-full w-64 shrink-0 flex-col bg-white shadow-[2px_0_12px_rgba(15,23,42,0.04)] transition-all duration-300 animate-slideRight dark:bg-slate-900 ${isRTL ? "border-l border-slate-150/80 dark:border-slate-800/60" : "border-r border-slate-150/80 dark:border-slate-800/60"}`}>
          {/* Header of Sidebar */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between shrink-0">
            <span className="text-[9.5px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t("aiAssistant.labels.conversations")}</span>
            <button
              type="button"
              onClick={handleNewChat}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer hover:scale-105 duration-150 shadow-sm"
              title={t("aiAssistant.labels.chat.newChatSession")}
            >
              <i className="fa-solid fa-plus text-[10px]" />
            </button>
          </div>
          {/* Recent Sessions list */}
          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5">
            {recentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="mb-3 h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
                  <i className="fa-solid fa-comments text-indigo-400 text-sm" />
                </div>
                <p className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">{t("aiAssistant.labels.noConversationsYet")}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{t("aiAssistant.labels.startChatHistory")}</p>
              </div>
            ) : (
              recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => loadSession(session.id)}
                  className={`ai-session-card ${currentSessionId === session.id ? "active" : ""} w-full rounded-xl py-2.5 transition-all cursor-pointer group flex flex-col gap-0.5 ${
                    isRTL ? "pr-4 pl-3 text-right" : "pl-4 pr-3 text-left"
                  } ${
                    currentSessionId === session.id
                      ? "bg-indigo-50/60 dark:bg-indigo-950/15 text-indigo-700 dark:text-indigo-300"
                      : "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:-translate-y-px"
                  } duration-150`}
                >
                  <div className="text-[12px] font-semibold truncate w-full leading-normal">{session.title}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">{relativeTime(session.createdAt)}</div>
                </button>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Main Framework Dashboard Workspace */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header — premium command center */}
        <header className="bg-white dark:bg-slate-900 px-6 py-4 shrink-0" style={{borderBottom:'1px solid rgba(226,232,240,0.7)',boxShadow:'0 1px 0 rgba(226,232,240,0.5), 0 2px 8px rgba(15,23,42,0.03)'}}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Logo + title */}
            <div className="flex items-center gap-3.5 shrink-0">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-white shadow-[0_6px_18px_rgba(99,102,241,0.28)] animate-gradShift"
                style={{background:'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#06b6d4 100%)',backgroundSize:'200% 200%'}}
              >
                <i className="fa-solid fa-sparkles text-[14px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[19px] font-black tracking-[-0.04em] ai-gradient-text">{t("aiAssistant.labels.title")}</h1>
                  <span className="rounded-full px-2 py-0.5 text-[8.5px] font-black uppercase tracking-[0.15em]" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1))',color:'#7c3aed',border:'1px solid rgba(139,92,246,0.15)'}}>
                    AI OS
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{t("aiAssistant.labels.subtitle")}</p>
              </div>
            </div>

            {/* Premium underline tab navigation */}
            <nav className="flex items-center gap-0">
              {[
                { id: "overview",  label: t("aiAssistant.labels.tabs.overview"),  icon: "fa-chart-pie" },
                { id: "actions",   label: t("aiAssistant.labels.tabs.actions"),   icon: "fa-bolt-lightning" },
                { id: "approvals", label: t("aiAssistant.labels.tabs.approvals"), icon: "fa-shield-halved" },
                { id: "insights",  label: t("aiAssistant.labels.tabs.insights"),  icon: "fa-eye" },
                { id: "chat",      label: t("aiAssistant.labels.tabs.chat"),      icon: "fa-comments" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-2 text-[11.5px] font-semibold transition-all duration-150 cursor-pointer rounded-lg ${
                    activeTab === tab.id
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px] ${ activeTab === tab.id ? "text-indigo-500" : "opacity-60" }`} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full animate-tabLine"
                      style={{background:'linear-gradient(90deg,#6366f1,#8b5cf6)'}}
                    />
                  )}
                </button>
              ))}
            </nav>

            {/* Context selectors + history toggle */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Space Select Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHeaderSpaceOpen(!headerSpaceOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:bg-slate-800 cursor-pointer transition-all duration-150"
                >
                  <i className="fa-solid fa-folder text-indigo-500 text-[10px]" />
                  {spaces.find(s => s.id === contextValues.spaceId)?.name || t("aiAssistant.labels.currentWorkspace")}
                  <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 ${isRTL ? "mr-0.5" : "ml-0.5"}`} />
                </button>
                {headerSpaceOpen && (
                  <>
                    <div className="fixed inset-0 z-35" onClick={() => setHeaderSpaceOpen(false)} />
                    <div className={`absolute top-full mt-1.5 z-45 max-h-60 w-52 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-slideUp dark:border-slate-700 dark:bg-slate-900 ${isRTL ? "left-0" : "right-0"}`}>
                      {spaces.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setContextValue("spaceId", s.id);
                            setContextValue("boardId", "");
                            setContextValue("taskId", "");
                            setActiveSpace(s.id);
                            setHeaderSpaceOpen(false);
                          }}
                          className={`w-full rounded-xl px-3.5 py-2.5 text-[11.5px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isRTL ? "text-right" : "text-left"} ${
                            contextValues.spaceId === s.id ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/40" : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Board Select Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  disabled={!contextValues.spaceId}
                  onClick={() => setHeaderBoardOpen(!headerBoardOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:bg-slate-800 cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-columns text-emerald-500 text-[10px]" />
                  {activeBoards.find(b => b.id === contextValues.boardId)?.name || t("aiAssistant.labels.currentBoard")}
                  <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 ${isRTL ? "mr-0.5" : "ml-0.5"}`} />
                </button>
                {headerBoardOpen && (
                  <>
                    <div className="fixed inset-0 z-35" onClick={() => setHeaderBoardOpen(false)} />
                    <div className={`absolute top-full mt-1.5 z-45 max-h-60 w-52 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-slideUp dark:border-slate-700 dark:bg-slate-900 ${isRTL ? "left-0" : "right-0"}`}>
                      {activeBoards.length === 0 ? (
                        <div className="px-3.5 py-2.5 text-[11.5px] text-slate-400 font-semibold">{t("aiAssistant.labels.noBoardsFound")}</div>
                      ) : (
                        activeBoards.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setContextValue("boardId", b.id);
                              setContextValue("taskId", "");
                              setActiveBoard(b.id);
                              setHeaderBoardOpen(false);
                            }}
                            className={`w-full rounded-xl px-3.5 py-2.5 text-[11.5px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isRTL ? "text-right" : "text-left"} ${
                              contextValues.boardId === b.id ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/40" : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {b.name}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Collapsible History Toggle */}
              {activeTab === "chat" && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer duration-150 ${
                    historyOpen
                      ? "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-800/50 dark:bg-indigo-950/20 dark:text-indigo-400"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <i className="fa-solid fa-sidebar text-[10px]" />
                  {historyOpen ? t("aiAssistant.labels.history.hide") : t("aiAssistant.labels.history.show")}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Outer body framework container */}
        <div className={`flex-1 min-h-0 flex flex-col ${activeTab === "chat" ? "overflow-hidden" : "overflow-y-auto px-6 py-6"}`}>
          {pageError && activeTab !== "chat" && (
            <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50/50 dark:border-rose-900/20 dark:bg-rose-950/10 px-4 py-3 text-[12px] leading-relaxed text-rose-605 dark:text-rose-455 flex items-center justify-between">
              <span>{pageError}</span>
              <button onClick={() => setPageError("")} className="text-rose-405 hover:text-rose-600"><i className="fa-solid fa-xmark" /></button>
            </div>
          )}

          {dashboardLoading && activeTab !== "chat" && (
            <div className="mb-6 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/10 px-4 py-2 text-[11px] font-bold text-indigo-500 animate-pulse flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin" />
              <span>{t("aiAssistant.labels.workspaceUpdating")}</span>
            </div>
          )}

          {/* OVERVIEW TAB: Redesigned Workspace Intelligence Center */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Metrics Grid */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboardLoading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="rounded-2xl bg-white dark:bg-slate-900 p-5 ai-skeleton border-none" style={{minHeight:88}} />
                  ))
                ) : (
                  [
                  { label: t("aiAssistant.labels.overview.openTasks"), value: dashboardData.metrics.openTasks, bar: "neutral", color: "text-slate-900 dark:text-slate-100" },
                  { label: t("aiAssistant.labels.overview.overdueTasks"), value: dashboardData.metrics.overdueTasks, bar: dashboardData.metrics.overdueTasks > 0 ? "danger" : "neutral", color: dashboardData.metrics.overdueTasks > 0 ? "text-rose-600" : "text-slate-900 dark:text-slate-100" },
                  { label: t("aiAssistant.labels.overview.blockedTasks"), value: dashboardData.metrics.blockedTasks, bar: dashboardData.metrics.blockedTasks > 0 ? "warning" : "neutral", color: dashboardData.metrics.blockedTasks > 0 ? "text-amber-600" : "text-slate-900 dark:text-slate-100" },
                  { label: t("aiAssistant.labels.overview.pendingApprovals"), value: dashboardData.metrics.pendingApprovals, bar: "info", color: "text-violet-600 dark:text-violet-400", sub: t("aiAssistant.labels.overview.staleApprovalsSuffix", { count: dashboardData.metrics.staleApprovals }) },
                  { label: t("aiAssistant.labels.overview.highRiskBoards"), value: dashboardData.metrics.highRiskProjects, bar: dashboardData.metrics.highRiskProjects > 0 ? "danger" : "neutral", color: dashboardData.metrics.highRiskProjects > 0 ? "text-rose-500" : "text-slate-900 dark:text-slate-100" },
                  { label: t("aiAssistant.labels.overview.overloadedMembers"), value: dashboardData.metrics.overloadedMembers, bar: "warning", color: "text-amber-600" },
                  { label: t("aiAssistant.labels.overview.upcomingDeadlines"), value: dashboardData.metrics.upcomingDeadlines, bar: "sky", color: "text-sky-600" },
                  { label: t("aiAssistant.labels.overview.meetingActions"), value: dashboardData.metrics.meetingActionsWaitingReview, bar: "info", color: "text-indigo-600" },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className={`ai-metric-bar ${stat.bar} rounded-2xl bg-white dark:bg-slate-900 py-5 transition-all duration-200 hover:-translate-y-0.5 cursor-default group ${isRTL ? "pr-6 pl-5" : "pl-6 pr-5"}`}
                    style={{boxShadow:'var(--shadow-card)'}}
                  >
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 block mb-2">{stat.label}</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-[30px] font-black tracking-tight leading-none ${stat.color}`}>{stat.value}</span>
                    </div>
                    {stat.sub && <span className="text-[9.5px] font-semibold text-slate-400 block mt-1">{stat.sub}</span>}
                  </div>
                  )))}
              </section>

              {/* Action Center & Executive Feed Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* AI Proposed Actions - Action Center */}
                <section className="ai-card-accent rounded-3xl bg-white dark:bg-slate-900 p-6 flex flex-col" style={{boxShadow:'var(--shadow-card)'}}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))'}}>
                        <i className="fa-solid fa-bolt-lightning text-indigo-500 text-[11px]" />
                      </div>
                      <div>
                        <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{t("aiAssistant.labels.overview.actionCenter")}</h3>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">{t("aiAssistant.labels.overview.actionCenterDescription")}</p>
                      </div>
                    </div>
                    <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.08))',color:'#6366f1',border:'1px solid rgba(99,102,241,0.15)'}}>
                      {t("aiAssistant.labels.overview.pendingBadge", { count: dashboardData.pendingActions.length })}
                    </span>
                  </div>

                  {dashboardData.pendingActions.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
                      <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-505 flex items-center justify-center mb-3">
                        <i className="fa-solid fa-circle-check text-lg" />
                      </div>
                      <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">{t("aiAssistant.labels.overview.governanceClean")}</h4>
                      <p className="text-[11px] text-slate-400 max-w-xs mt-1">{t("aiAssistant.labels.overview.governanceCleanDescription")}</p>
                    </div>
                  ) : (
                    <div className={`space-y-3 flex-1 overflow-y-auto max-h-[320px] ${isRTL ? "pl-1" : "pr-1"}`}>
                      {dashboardData.pendingActions.map((action) => (
                        <div key={action.id} className="rounded-2xl bg-slate-50 dark:bg-slate-955 p-4 border-none shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                          <div className="flex justify-between items-start gap-2">
                            <span className="rounded-full bg-slate-202 dark:bg-slate-850 px-2 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-335 tracking-wide uppercase">
                              {action.commandType}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">{formatTime(action.createdAt)}</span>
                          </div>
                          <p className="mt-2 text-[12px] font-bold text-slate-800 dark:text-slate-255 leading-relaxed">{action.reason}</p>
                          <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                            <button
                              type="button"
                              disabled={reviewingActionId === action.id}
                              onClick={() => void reviewFeedAction(action.id, "approve")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-55 cursor-pointer shadow-sm"
                            >
                              <i className="fa-solid fa-check" /> {t("aiAssistant.labels.actions.approve")}
                            </button>
                            <button
                              type="button"
                              disabled={reviewingActionId === action.id}
                              onClick={() => void reviewFeedAction(action.id, "reject")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white dark:bg-slate-900 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-455 transition hover:bg-rose-55 dark:hover:bg-rose-955/20 disabled:opacity-55 cursor-pointer"
                            >
                              <i className="fa-solid fa-xmark" /> {t("aiAssistant.labels.actions.reject")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Executive Feed - Activity Log */}
                <section className="ai-card-accent rounded-3xl bg-white dark:bg-slate-900 p-6 flex flex-col" style={{boxShadow:'var(--shadow-card)'}}>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,rgba(239,68,68,0.10),rgba(245,158,11,0.06))'}}>
                        <i className="fa-solid fa-circle-exclamation text-rose-500 text-[11px]" />
                      </div>
                      <div>
                        <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{t("aiAssistant.labels.overview.executiveFeed")}</h3>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">{t("aiAssistant.labels.overview.executiveFeedDescription")}</p>
                      </div>
                    </div>
                    <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  </div>

                  <div className={`space-y-3.5 flex-1 overflow-y-auto max-h-[320px] ${isRTL ? "pl-1" : "pr-1"}`}>
                    {dashboardData.insights.map((item) => (
                      <div key={item.id} className={`flex gap-3 items-start ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}>
                        <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-xl ${
                          item.severity === "high"
                            ? "bg-rose-50 text-rose-500 dark:bg-rose-950/25"
                            : item.severity === "warning"
                              ? "bg-amber-50 text-amber-500 dark:bg-amber-950/25"
                              : "bg-sky-50 text-sky-500 dark:bg-sky-950/25"
                        }`}>
                          <i className={`fa-solid ${
                            item.severity === "high"
                              ? "fa-circle-xmark"
                              : item.severity === "warning"
                                ? "fa-circle-exclamation"
                                : "fa-circle-info"
                          } text-sm`} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12.5px] font-semibold text-slate-750 dark:text-slate-300 leading-relaxed">{item.message}</p>
                          <span className="text-[9px] text-slate-400 font-bold block mt-1">
                            {formatTime(item.timestamp, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Workflow, Decisions & Meeting Intelligence Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Meeting Intelligence Widget */}
                <section className="ai-card-accent rounded-3xl bg-white dark:bg-slate-900 p-6" style={{boxShadow:'var(--shadow-card)'}}>
                  <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/50 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,rgba(6,182,212,0.12),rgba(99,102,241,0.06))'}}>
                      <i className="fa-solid fa-microphone-lines text-sky-500 text-[11px]" />
                    </div>
                    <div>
                        <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{t("aiAssistant.labels.overview.recentMeetingIntelligence")}</h3>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">{t("aiAssistant.labels.overview.recentMeetingDescription")}</p>
                      </div>
                    </div>

                  {dashboardData.meetingIntelligence.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-slate-400">
                      {t("aiAssistant.labels.overview.noMeetings")}
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {dashboardData.meetingIntelligence.map((meeting) => (
                        <div key={meeting.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-955 rounded-2xl">
                          <div className="min-w-0">
                            <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 block truncate">{meeting.title}</span>
                            <span className="text-[9px] font-bold text-slate-400">{formatDate(meeting.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-405">
                              {t("aiAssistant.labels.overview.tasksExtracted", { count: meeting.proposedTasksCount })}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setComposer(t("aiAssistant.labels.overview.openMeetingPrompt", { title: meeting.title }));
                                setActiveTab("chat");
                              }}
                              className="text-[11px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer"
                            >
                              {t("aiAssistant.labels.overview.open")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Decision Register Widget */}
                <section className="ai-card-accent rounded-3xl bg-white dark:bg-slate-900 p-6" style={{boxShadow:'var(--shadow-card)'}}>
                  <div className="mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/50 flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.06))'}}>
                      <i className="fa-solid fa-scale-balanced text-emerald-500 text-[11px]" />
                    </div>
                    <div>
                        <h3 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{t("aiAssistant.labels.overview.recentDecisions")}</h3>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">{t("aiAssistant.labels.overview.recentDecisionsDescription")}</p>
                      </div>
                    </div>

                  {dashboardData.recentDecisions.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-slate-400">
                      {t("aiAssistant.labels.overview.noDecisions")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dashboardData.recentDecisions.map((dec) => (
                        <div key={dec.id} className="p-3 bg-slate-50 dark:bg-slate-955 rounded-2xl">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 truncate">{dec.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${
                              dec.outcome === "APPROVED"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450"
                            }`}>
                              {dec.outcome}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">{dec.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* ACTIONS TAB: Detailed proposed action records */}
          {activeTab === "actions" && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm animate-fadeIn">
              <div className="mb-6 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                <h2 className="text-[16px] font-black text-slate-900 dark:text-slate-100">{t("aiAssistant.labels.actions.title")}</h2>
                <p className="text-[12px] text-slate-550 mt-0.5">{t("aiAssistant.labels.actions.description")}</p>
              </div>

              {dashboardData.pendingActions.length === 0 ? (
                <div className="py-12 text-center text-slate-405">
                  <i className="fa-solid fa-circle-check text-3xl text-emerald-400 mb-3" />
                  <p className="text-[13px] font-bold text-slate-700 dark:text-slate-350">{t("aiAssistant.labels.actions.allResolved")}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t("aiAssistant.labels.actions.allResolvedDescription")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-850">
                  {dashboardData.pendingActions.map((action) => (
                    <div key={action.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-black text-slate-808 dark:text-slate-150">{action.commandType}</span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                            {t("aiAssistant.labels.actions.pendingApproval")}
                          </span>
                        </div>
                        <p className="text-[12.5px] leading-relaxed text-slate-650 dark:text-slate-400">{action.reason}</p>
                        <div className="text-[10px] font-bold text-slate-400">{t("aiAssistant.labels.actions.proposedAt", { date: formatDateTime(action.createdAt) })}</div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button
                          type="button"
                          disabled={reviewingActionId === action.id}
                          onClick={() => void reviewFeedAction(action.id, "approve")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white transition disabled:opacity-55 cursor-pointer shadow-sm"
                        >
                          <i className="fa-solid fa-check" /> {t("aiAssistant.labels.actions.approve")}
                        </button>
                        <button
                          type="button"
                          disabled={reviewingActionId === action.id}
                          onClick={() => void reviewFeedAction(action.id, "reject")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white dark:bg-slate-900 px-4 py-2 text-[11px] font-bold text-rose-600 dark:text-rose-455 transition hover:bg-rose-50 dark:hover:bg-rose-955/20 disabled:opacity-55 cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark" /> {t("aiAssistant.labels.actions.reject")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* APPROVALS TAB: Workflow Governance details */}
          {activeTab === "approvals" && (
            <div className="space-y-6 animate-fadeIn">
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{t("aiAssistant.labels.approvals.totalPending")}</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{dashboardData.metrics.pendingApprovals}</span>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{t("aiAssistant.labels.approvals.stale")}</span>
                  <span className={`text-3xl font-black ${dashboardData.metrics.staleApprovals > 0 ? "text-rose-500" : "text-slate-900 dark:text-slate-100"}`}>
                    {dashboardData.metrics.staleApprovals}
                  </span>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{t("aiAssistant.labels.approvals.escalated")}</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{dashboardData.metrics.meetingActionsWaitingReview}</span>
                </div>
              </section>

              <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                  <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">{t("aiAssistant.labels.approvals.queueTitle")}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t("aiAssistant.labels.approvals.queueDescription")}</p>
                </div>

                {dashboardData.approvals.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    {t("aiAssistant.labels.approvals.noApprovals")}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-850">
                    {dashboardData.approvals.map((app) => (
                      <div key={app.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[12.5px] font-bold text-slate-850 dark:text-slate-200 block">{app.title}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{t("aiAssistant.labels.approvals.started", { date: formatDateTime(app.startedAt) })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.isStale && (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                              {t("aiAssistant.labels.approvals.staleBadge")}
                            </span>
                          )}
                          <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                            {app.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* INSIGHTS TAB: Risks and Workload details */}
          {activeTab === "insights" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
              {/* Workspace Risks List */}
              <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40 flex items-center justify-between">
                  <div>
                  <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">{t("aiAssistant.labels.insights.risksTitle")}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t("aiAssistant.labels.insights.risksDescription")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void triggerDirectScan("board_risk")}
                    disabled={Boolean(activeActionKey) || isStreaming}
                    className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 px-3 py-1 rounded-full text-[10px] font-bold text-rose-600 dark:text-rose-455 cursor-pointer"
                  >
                    <i className={`fa-solid ${activeActionKey === "board_risk" ? "fa-spinner fa-spin" : "fa-shield-halved"}`} />
                    {t("aiAssistant.labels.insights.deepScan")}
                  </button>
                </div>

                {dashboardData.risks.length === 0 ? (
                  <div className="py-12 text-center text-slate-450">
                    {t("aiAssistant.labels.insights.noRisks")}
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {dashboardData.risks.map((risk) => (
                      <div key={risk.id} className="p-3 bg-slate-50 dark:bg-slate-955 rounded-2xl">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12.5px] font-bold text-slate-808 dark:text-slate-200 truncate">{risk.title}</span>
                          <span className="rounded-full bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                            {risk.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 font-semibold mt-2">
                          <span>{t("aiAssistant.labels.insights.board", { name: risk.boardName })}</span>
                          {risk.dueDate && (
                            <span className="text-rose-500">
                              {t("aiAssistant.labels.insights.overdue", { date: formatDate(risk.dueDate) })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Workload Capacities List */}
              <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
                <div className="mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                  <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">{t("aiAssistant.labels.insights.workloadTitle")}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t("aiAssistant.labels.insights.workloadDescription")}</p>
                </div>

                <div className="space-y-4 flex-1">
                  {/* Visual list of members with bar indicators */}
                  {dashboardData.insights.some(i => i.id.startsWith("overload-")) ? (
                    <div className="space-y-3">
                      {dashboardData.insights
                        .filter(i => i.id.startsWith("overload-"))
                        .map((ol, idx) => (
                          <div key={idx} className="p-3 bg-amber-50/50 dark:bg-amber-955/10 rounded-2xl border border-amber-100/50">
                            <span className="text-[12px] font-bold text-amber-800 dark:text-amber-450 flex items-center gap-1.5">
                              <i className="fa-solid fa-users-viewfinder" />
                              {ol.message}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-450">
                      {t("aiAssistant.labels.insights.allBalanced")}
                    </div>
                  )}

                  <div className="rounded-2xl border border-dashed border-slate-150 dark:border-slate-808 bg-slate-50/50 dark:bg-slate-955/20 p-4 text-[11px] leading-relaxed text-slate-500 mt-4">
                    {t("aiAssistant.labels.insights.capacityAlgorithm")}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* CHAT TAB: Conversational intelligence console */}
          {activeTab === "chat" && (
            <div className="relative flex flex-1 flex-col overflow-hidden w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 rounded-t-[24px] h-full animate-fadeIn" style={{boxShadow:'0 -2px 20px rgba(15,23,42,0.05)',borderTop:'1px solid rgba(226,232,240,0.8)',borderLeft:'1px solid rgba(226,232,240,0.5)',borderRight:'1px solid rgba(226,232,240,0.5)'}}>
              {pageError && (
                <div className="mx-5 mt-4 mb-2 rounded-2xl border border-rose-100 bg-rose-50 dark:border-rose-900/20 dark:bg-rose-950/10 px-4 py-3 text-[12px] leading-relaxed text-rose-700 dark:text-rose-400 flex items-center justify-between">
                  <span className="flex items-center gap-2"><i className="fa-solid fa-circle-exclamation" />{pageError}</span>
                  <button onClick={() => setPageError("")} className={`text-rose-400 hover:text-rose-600 ${isRTL ? "mr-3" : "ml-3"}`}><i className="fa-solid fa-xmark" /></button>
                </div>
              )}
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto px-6 pt-6 pb-52 space-y-5">
                {filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8 max-w-lg mx-auto h-full pb-28">
                    {/* Animated gradient orb */}
                    <div className="relative mb-6">
                      <div
                        className="absolute inset-0 rounded-full blur-2xl animate-orbPulse"
                        style={{background:'linear-gradient(135deg,rgba(99,102,241,0.35),rgba(139,92,246,0.25),rgba(6,182,212,0.20))',width:80,height:80,top:-8,left:-8}}
                      />
                      <div
                        className="relative flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[0_12px_32px_rgba(99,102,241,0.28)]"
                        style={{background:'linear-gradient(135deg,#6366f1 0%,#8b5cf6 55%,#06b6d4 100%)'}}
                      >
                        <i className="fa-solid fa-sparkles text-xl" />
                      </div>
                    </div>
                  <h3 className="text-[18px] font-black tracking-tight ai-gradient-text mb-1">{t("aiAssistant.labels.title")}</h3>
                  <p className="text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400 max-w-sm mb-7">
                      {t("aiAssistant.labels.chat.emptyDescription")}
                  </p>

                    <div className={`w-full ${isRTL ? "text-right" : "text-left"}`}>
                      <span className={`text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 block mb-3 ${isRTL ? "pr-1" : "pl-1"}`}>{t("aiAssistant.labels.chat.workspaceQueries")}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {quickPromptItems.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => void runChat(item.prompt)}
                            className={`flex items-center gap-3 w-full rounded-2xl bg-white dark:bg-slate-800/80 p-3.5 transition-all cursor-pointer group hover:-translate-y-0.5 animate-popIn ${isRTL ? "flex-row-reverse text-right" : "text-left"}`}
                            style={{border:'1px solid rgba(226,232,240,0.8)',boxShadow:'var(--shadow-card)'}}
                          >
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-150 ${item.accentClassName}`}>
                              <i className={`fa-solid ${item.icon} text-[11px]`} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 leading-snug block">{item.label}</span>
                            </div>
                            <i className={`fa-solid ${isRTL ? "fa-arrow-left" : "fa-arrow-right"} text-[9px] text-slate-300 dark:text-slate-600 ${isRTL ? "mr-auto" : "ml-auto"} shrink-0 group-hover:text-indigo-400 transition-colors`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {filteredMessages.map((message) => {
                      const isUser = message.role === "user";
                      return (
                        <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                          {!isUser && (
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_4px_12px_rgba(99,102,241,0.22)] shrink-0"
                              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}
                            >
                              <i className="fa-solid fa-sparkles text-[11px]" />
                            </div>
                          )}
                          <div className={`${isUser ? "max-w-[82%] order-first" : "max-w-[860px] w-full h-auto"}`}>
                            <ChatBubble
                              message={message}
                              feedbackState={message.traceId ? messageFeedback[message.traceId] : null}
                              onFeedback={(traceId, rating) => void handleMessageFeedback(traceId, rating)}
                              onRetry={handleRetry}
                              onCitationClick={handleCitationClick}
                              onActionDecision={reviewFeedAction}
                              reviewingActionId={reviewingActionId}
                            />
                          </div>
                          {isUser && (
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white uppercase"
                              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',boxShadow:'0 3px 10px rgba(99,102,241,0.25)'}}
                            >
                              {(user?.name || user?.email || "U").slice(0, 2)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Floating Input Area — premium composer */}
              <div className="absolute bottom-0 left-0 right-0 px-5 pt-4 pb-5 bg-gradient-to-t from-white via-white/98 to-transparent dark:from-slate-900 dark:via-slate-900/98 dark:to-transparent z-10 w-full shrink-0">
                <div className="max-w-3xl mx-auto w-full">
                  {/* Suggestion Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3 items-center">
                    <span className={`text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.12em] ${isRTL ? "ml-0.5" : "mr-0.5"}`}>{t("aiAssistant.labels.chat.tryAsking")}</span>
                    {t("aiAssistant.suggestionChips", { returnObjects: true }).map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => void runChat(chip.prompt)}
                        className="rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3 py-1 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-600 duration-150"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Gradient-border composer shell */}
                  <div className="ai-composer-shell">
                    <div className="ai-composer-inner p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.08),0_1px_4px_rgba(15,23,42,0.06)] dark:bg-slate-900">
                      <div className="flex items-end gap-3">
                        <textarea
                          ref={textareaRef}
                          rows={1}
                          value={composer}
                          onChange={(e) => {
                            setComposer(e.target.value.slice(0, MAX_COMPOSER_LENGTH));
                            setPageError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSubmit();
                            }
                          }}
                          placeholder={t("aiAssistant.labels.chat.composerPlaceholder")}
                          className={`min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 ${isRTL ? "text-right" : "text-left"}`}
                        />

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-medium shrink-0 self-center tabular-nums ${isRTL ? "pl-1" : "pr-1"} ${
                              composer.length >= MAX_COMPOSER_LENGTH - 200
                                ? "text-rose-500 animate-pulse"
                                : "text-slate-300 dark:text-slate-600"
                            }`}
                          >
                            {composer.length}/{MAX_COMPOSER_LENGTH}
                          </span>

                          {isStreaming ? (
                            <button
                              type="button"
                              onClick={() => chatAbortRef.current?.abort()}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition cursor-pointer hover:scale-105 duration-150"
                              aria-label={t("aiAssistant.labels.chat.stopStreaming")}
                              style={{boxShadow:'0 4px 12px rgba(239,68,68,0.28)'}}
                            >
                              <i className="fa-solid fa-stop text-[11px]" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSubmit}
                              disabled={!composer.trim()}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-35 disabled:cursor-not-allowed disabled:scale-100 hover:scale-105 cursor-pointer duration-150"
                              aria-label={t("aiAssistant.labels.chat.sendMessage")}
                              style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',boxShadow:'var(--shadow-send)'}}
                            >
                              <i className="fa-solid fa-arrow-up text-[11px]" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Interactive Selectors Row */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-[11px] font-bold">
                      {/* Space Select Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setSpaceDropdownOpen(!spaceDropdownOpen)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition-colors"
                        >
                          <i className="fa-solid fa-folder text-indigo-500 text-[10px]" />
                          {spaces.find(s => s.id === contextValues.spaceId)?.name || t("aiAssistant.labels.currentWorkspace")}
                          <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 ${isRTL ? "mr-0.5" : "ml-0.5"}`} />
                        </button>
                        {spaceDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setSpaceDropdownOpen(false)} />
                            <div className={`absolute bottom-full mb-2.5 z-40 max-h-60 w-52 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-slideUp dark:border-slate-808 dark:bg-slate-900 ${isRTL ? "right-0" : "left-0"}`}>
                              {spaces.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setContextValue("spaceId", s.id);
                                    setContextValue("boardId", "");
                                    setContextValue("taskId", "");
                                    setActiveSpace(s.id);
                                    setSpaceDropdownOpen(false);
                                  }}
                                  className={`w-full rounded-xl px-3.5 py-2.5 text-[11.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isRTL ? "text-right" : "text-left"} ${
                                    contextValues.spaceId === s.id
                                      ? "text-indigo-650 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-955/20"
                                      : "text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {s.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Board Select Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!contextValues.spaceId}
                          onClick={() => setBoardDropdownOpen(!boardDropdownOpen)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <i className="fa-solid fa-columns text-emerald-500 text-[10px]" />
                          {activeBoards.find(b => b.id === contextValues.boardId)?.name || t("aiAssistant.labels.currentBoard")}
                          <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 ${isRTL ? "mr-0.5" : "ml-0.5"}`} />
                        </button>
                        {boardDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setBoardDropdownOpen(false)} />
                            <div className={`absolute bottom-full mb-2.5 z-40 max-h-60 w-52 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-slideUp dark:border-slate-808 dark:bg-slate-900 ${isRTL ? "right-0" : "left-0"}`}>
                              {activeBoards.length === 0 ? (
                                <div className="px-3.5 py-2.5 text-[11.5px] text-slate-400 font-semibold">{t("aiAssistant.labels.noBoardsFound")}</div>
                              ) : (
                                activeBoards.map((b) => (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => {
                                      setContextValue("boardId", b.id);
                                      setContextValue("taskId", "");
                                      setActiveBoard(b.id);
                                      setBoardDropdownOpen(false);
                                    }}
                                    className={`w-full rounded-xl px-3.5 py-2.5 text-[11.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isRTL ? "text-right" : "text-left"} ${
                                      contextValues.boardId === b.id
                                        ? "text-indigo-650 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-955/20"
                                        : "text-slate-700 dark:text-slate-300"
                                    }`}
                                  >
                                    {b.name}
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Task Select Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          disabled={!contextValues.boardId || tasksQuery.isLoading}
                          onClick={() => setTaskDropdownOpen(!taskDropdownOpen)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <i className="fa-solid fa-list-check text-sky-500 text-[10px]" />
                          {boardTasks.find(t => t.id === contextValues.taskId)?.title || t("aiAssistant.labels.focusTask")}
                          <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 ${isRTL ? "mr-0.5" : "ml-0.5"}`} />
                        </button>
                        {taskDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setTaskDropdownOpen(false)} />
                            <div className={`absolute bottom-full mb-2.5 z-40 max-h-60 w-64 overflow-y-auto rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-slideUp dark:border-slate-808 dark:bg-slate-900 ${isRTL ? "right-0" : "left-0"}`}>
                              {boardTasks.length === 0 ? (
                                <div className="px-3.5 py-2.5 text-[11.5px] text-slate-400 font-semibold">{t("aiAssistant.labels.noTasksFound")}</div>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setContextValue("taskId", "");
                                      setTaskDropdownOpen(false);
                                    }}
                                    className={`w-full rounded-xl px-3.5 py-2 text-[11.5px] font-bold text-rose-505 hover:bg-slate-50 dark:hover:bg-slate-800 ${isRTL ? "text-right" : "text-left"}`}
                                  >
                                    {t("aiAssistant.labels.clearTaskFocus")}
                                  </button>
                                  {boardTasks.map((t) => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => {
                                        setContextValue("taskId", t.id);
                                        setTaskDropdownOpen(false);
                                      }}
                                      className={`w-full rounded-xl px-3.5 py-2.5 text-[11.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 truncate ${isRTL ? "text-right" : "text-left"} ${
                                        contextValues.taskId === t.id
                                          ? "text-indigo-650 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-955/20"
                                          : "text-slate-700 dark:text-slate-300"
                                      }`}
                                    >
                                      {t.title || t.name}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Tone Select Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setToneDropdownOpen(!toneDropdownOpen)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400 transition-colors"
                        >
                          <i className="fa-solid fa-signature text-violet-500 text-[10px]" />
                          {t(`aiAssistant.labels.tones.${contextValues.commentTone}`)}
                          <i className={`fa-solid fa-chevron-down text-[8px] opacity-50 ${isRTL ? "mr-0.5" : "ml-0.5"}`} />
                        </button>
                        {toneDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setToneDropdownOpen(false)} />
                            <div className={`absolute bottom-full mb-2.5 z-40 w-36 rounded-2xl border border-slate-150 bg-white p-1.5 shadow-xl animate-slideUp dark:border-slate-808 dark:bg-slate-900 ${isRTL ? "right-0" : "left-0"}`}>
                              {["professional", "friendly", "concise", "urgent"].map((tone) => (
                                <button
                                  key={tone}
                                  type="button"
                                  onClick={() => {
                                    setContextValue("commentTone", tone);
                                    setToneDropdownOpen(false);
                                  }}
                                  className={`w-full rounded-xl px-3.5 py-2 text-[11.5px] font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isRTL ? "text-right" : "text-left"} ${
                                    contextValues.commentTone === tone
                                      ? "text-indigo-650 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-955/20"
                                      : "text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {t(`aiAssistant.labels.tones.${tone}`)}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Action buttons (Clear / Report) */}
                      <div className={`${isRTL ? "mr-auto border-r pr-2" : "ml-auto border-l pl-2"} flex gap-1 border-slate-100/80 dark:border-slate-800/60`}>
                        <button
                          type="button"
                          onClick={handleNewChat}
                          className="inline-flex items-center gap-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-1 text-[10.5px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer transition-colors"
                          title={t("aiAssistant.labels.chat.newChatSession")}
                        >
                          <i className="fa-solid fa-rotate text-[9px]" />
                          {t("aiAssistant.labels.chat.newChat")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void triggerDirectScan("report")}
                          disabled={Boolean(activeActionKey) || isStreaming}
                          className="inline-flex items-center gap-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 px-2.5 py-1 text-[10.5px] font-semibold text-indigo-500 hover:text-indigo-600 disabled:opacity-40 cursor-pointer transition-colors"
                          title={t("aiAssistant.labels.chat.generateStatusReport")}
                        >
                          <i className="fa-solid fa-file-invoice text-[9px]" />
                          {t("aiAssistant.labels.chat.report")}
                        </button>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Meeting Transcript Modal */}
      {transcriptModalOpen && activeMeetingTranscript && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-808 flex flex-col max-h-[85vh] overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{t("aiAssistant.transcript.title")}</span>
                <h3 className="text-[15px] font-black text-slate-900 dark:text-slate-100 truncate max-w-[450px]">
                  {activeMeetingTranscript.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTranscriptModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 text-[13px] leading-6 whitespace-pre-wrap text-slate-750 dark:text-slate-350">
              {loadingTranscript ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-500" />
                  <span className="text-slate-400 font-bold">{t("aiAssistant.transcript.decrypting")}</span>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-955 p-4.5 rounded-2xl border border-slate-150/50 dark:border-slate-808/60 font-sans">
                  {activeMeetingTranscript.text}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex justify-end bg-slate-50/50 dark:bg-slate-955/20">
              <button
                type="button"
                onClick={() => setTranscriptModalOpen(false)}
                className="rounded-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white px-5 py-2 text-[11.5px] font-bold text-white dark:text-slate-900 transition cursor-pointer shadow-sm"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={handleToastClose} />
    </div>
  );
}

function AiAssistantPageWithErrorBoundary(props) {
  const { t } = useTranslation();
  return (
    <ErrorBoundary fallbackMessage={t("aiAssistant.labels.errorBoundary")}>
      <AiAssistantPage {...props} />
    </ErrorBoundary>
  );
}

export default AiAssistantPageWithErrorBoundary;
