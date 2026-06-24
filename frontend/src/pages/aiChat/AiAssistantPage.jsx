import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import { useAppContext } from "../AppContext";
import {
  useAiActionReviewMutation,
  useAiChatMutation,
  useAiContextQuery,
  useAiDashboardQuery,
  useAiFeedbackMutation,
  useAiReportMutation,
  useAiRiskMutation,
  useAiStreamingMutation,
} from "../../hooks/useAiQueries";
import { useBoard } from "../../hooks/api/useBoards";
import {
  useMeetingsQuery,
  useMeetingUploadMutation,
  useProposedTaskApproveMutation,
  useProposedTaskRejectMutation,
} from "../../hooks/useMeetingsQueries";
import { extractTextFromPayload } from "../../utils/extractTextFromPayload";
import { useBoardTasksQuery } from "../../hooks/useTaskListQueries";
import ErrorBoundary from "../../components/ErrorBoundary";

const STORAGE_KEYS = {
  context: "mongez.ai.context",
  sessions: "mongez.ai.sessions",
};
const MAX_COMPOSER_LENGTH = 4000;

function buildQuickPrompts() {
  return [
    {
      label: "What will miss deadline this week?",
      icon: "fa-triangle-exclamation",
      accentClassName: "text-rose-500 bg-rose-50 dark:bg-rose-950/20",
      prompt: "Show me all blocked or overdue tasks that are at risk of missing their deadlines this week.",
    },
    {
      label: "Which approvals are blocking progress?",
      icon: "fa-shield-halved",
      accentClassName: "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
      prompt: "Identify all pending workflow approvals that have been waiting for more than 48 hours.",
    },
    {
      label: "Who is overloaded right now?",
      icon: "fa-users",
      accentClassName: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
      prompt: "Analyze team workload and point out which assignees have crossed their task capacity threshold.",
    },
    {
      label: "What should I escalate today?",
      icon: "fa-arrow-up-right-dots",
      accentClassName: "text-sky-500 bg-sky-50 dark:bg-sky-950/20",
      prompt: "Give me a list of tasks that have been stuck in the same column for over 5 days and need manager escalation.",
    },
    {
      label: "Generate executive status report",
      icon: "fa-file-invoice",
      accentClassName: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
      prompt: "Generate an executive project status report summarizing current progress, major risks, and key decisions.",
    },
    {
      label: "Show hidden project risks",
      icon: "fa-eye",
      accentClassName: "text-purple-500 bg-purple-50 dark:bg-purple-950/20",
      prompt: "Scan our workspace database and list hidden dependency bottlenecks or potential project risks.",
    },
  ];
}

const welcomeMessage = {
  id: "welcome-message",
  role: "assistant",
  kind: "welcome",
  text: "Welcome to Mongez Intelligence Engine. How can I assist you with workspace oversight today? You can choose one of the quick commands below or start a conversation.",
};

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

function createSessionSnapshot({ sessionId, messages, context }) {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.kind === "text");
  return {
    id: sessionId,
    title: truncateText(firstUserMessage?.text || "Untitled conversation"),
    createdAt: new Date().toISOString(),
    messages,
    context,
  };
}

function getUserFriendlyErrorMessage(error) {
  if (!error) return "An unexpected error occurred. Please try again.";
  if (typeof error === "string") return error;
  const status = error.status || error.response?.status;
  const message = error.message || "";

  if (message.toLowerCase().includes("network") || message.toLowerCase().includes("timeout") || error.code === "ECONNABORTED") {
    return "Connection error or timeout. Check your internet connection and try again.";
  }

  switch (status) {
    case 400: return "Invalid request parameters. Please verify context.";
    case 401: return "Session expired. Please sign in again.";
    case 403: return "Access denied. Insufficient workspace permissions.";
    case 404: return "AI resource not found.";
    case 429: return "AI rate limit reached. Please wait a moment.";
    case 500: return "Internal error in the AI service. Try again later.";
    default: return message || "An unexpected error occurred.";
  }
}

function FieldLabel({ children }) {
  return <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">{children}</label>;
}

function ChatBubble({ message, feedbackState, onFeedback, onRetry }) {
  if (message.kind === "welcome") {
    return (
      <div className="rounded-[24px] rounded-tl-md border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-[13px] leading-6 text-slate-650 dark:text-slate-350 shadow-sm">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{message.text}</p>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="rounded-[24px] rounded-tr-md bg-slate-900 dark:bg-slate-100 px-5 py-4 text-[13px] leading-6 whitespace-pre-wrap text-white dark:text-slate-900 shadow-md font-medium">
        {message.text}
      </div>
    );
  }

  return (
    <div className="rounded-[24px] rounded-tl-md border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
      {message.label && (
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <i className={`fa-solid ${message.icon || "fa-sparkles"} text-indigo-500`} />
          <span>{message.label}</span>
        </div>
      )}

      <div className="text-[13px] leading-6 whitespace-pre-wrap text-slate-750 dark:text-slate-300">
        {message.text || (message.loading ? "Thinking..." : "")}
      </div>

      {message.error && (
        <div className="mt-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 px-3.5 py-2.5 flex items-center justify-between gap-3 border border-rose-100/50 dark:border-rose-900/30">
          <span className="text-[12px] text-rose-600 dark:text-rose-455 font-bold leading-relaxed">{message.error}</span>
          <button
            type="button"
            onClick={() => onRetry?.(message.id)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 px-3 py-1 text-[11px] font-bold text-white transition-all cursor-pointer shadow-sm"
          >
            <i className="fa-solid fa-arrows-rotate" />
            Retry
          </button>
        </div>
      )}

      {message.traceId && !message.loading && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-55 dark:border-slate-800/40 pt-2.5">
          <button
            type="button"
            disabled={feedbackState?.submitting}
            onClick={() => onFeedback(message.traceId, "positive")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors cursor-pointer ${
              feedbackState?.rating === "positive"
                ? "border-emerald-205 bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-808 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <i className={`fa-solid ${feedbackState?.submitting ? "fa-spinner fa-spin" : "fa-thumbs-up"}`} />
            Helpful
          </button>
          <button
            type="button"
            disabled={feedbackState?.submitting}
            onClick={() => onFeedback(message.traceId, "negative")}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold tracking-wide uppercase transition-colors cursor-pointer ${
              feedbackState?.rating === "negative"
                ? "border-amber-205 bg-amber-50/80 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-808 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            <i className="fa-solid fa-thumbs-down" />
            Needs work
          </button>
        </div>
      )}
    </div>
  );
}

function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
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
            className="ml-auto flex h-5 w-5 items-center justify-center rounded-lg hover:bg-slate-900/5 text-slate-400 hover:text-slate-650 transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        </div>
      ))}
    </div>
  );
}

function AiAssistantPage() {
  const { setPath } = useOutletContext();
  const { activeSpace, activeBoard, spaces, activeBoards, setActiveSpace, setActiveBoard, user } = useAppContext();
  const [composer, setComposer] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
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
  const [messages, setMessages] = useState([welcomeMessage]);
  const [pageError, setPageError] = useState("");
  const [activeActionKey, setActiveActionKey] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [reviewingActionId, setReviewingActionId] = useState("");
  const [messageFeedback, setMessageFeedback] = useState({});
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatAbortRef = useRef(null);

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

  const quickPromptItems = useMemo(() => buildQuickPrompts(), []);

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

  const fallbackChatMutation = useAiChatMutation();
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
      { name: activeSpace?.name || "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: "Mongez Intelligence", color: "text-slate-800", ref: "" },
    ]);
  }, [setPath, activeSpace?.name]);

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
      setPageError(`Messages are limited to ${MAX_COMPOSER_LENGTH} characters.`);
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
      label: "Intelligence Response",
      icon: "fa-sparkles",
      loading: true,
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
      const { text, traceId } = await streamingChatMutation.mutateAsync({
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
      });

      setMessages((currentMessages) => {
        const finalizedMessages = currentMessages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: message.text || text || "Done.",
                loading: false,
                traceId: message.traceId || traceId || "",
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
              ? { ...message, loading: false, error: "Response stopped." }
              : message,
          );
          persistCurrentSession(abortedMessages);
          return abortedMessages;
        });
      } else {
        const errorMessage = getUserFriendlyErrorMessage(error);
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
        appendAssistantResult("Board Risk Assessment", formatApiResult(payload), {
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
        appendAssistantResult("AI Executive Status Report", formatApiResult(payload), {
          icon: "fa-file-lines",
          traceId: extractTraceId(payload),
        });
      }
    } catch (error) {
      setPageError(getUserFriendlyErrorMessage(error));
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
      showToast("Feedback submitted successfully!", "success");
    } catch (error) {
      setPageError(getUserFriendlyErrorMessage(error));
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
      showToast(`AI proposed action ${decision === "approve" ? "approved" : "rejected"} successfully.`, "success");
      void dashboardQuery.refetch();
    } catch (error) {
      setPageError(getUserFriendlyErrorMessage(error));
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
    showToast("New chat session started", "info");
  };

  const loadSession = (sessionId) => {
    const session = recentSessions.find((item) => item.id === sessionId);
    if (!session) return;
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setContextValues(session.context || contextValues);
    setContextOpen(false);
    setActiveTab("chat");
  };

  const filteredMessages = messages.filter((m) => m.kind !== "welcome");

  return (
    <div className="relative flex flex-1 overflow-hidden bg-slate-55 dark:bg-slate-950 font-sans">
      {/* Configuration Drawer Overlay Backdrop */}
      {contextOpen && (
        <button
          type="button"
          aria-label="Close context panel"
          onClick={() => setContextOpen(false)}
          className="absolute inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] transition-all"
        />
      )}

      {/* Configuration Slider Panel Drawer (Slide over right) */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-85 border-l border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 p-5 shadow-2xl transition-transform duration-300 flex flex-col gap-6 ${
          contextOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Settings</span>
            <h2 className="text-[15px] font-black text-slate-900 dark:text-slate-150">Workspace Context</h2>
          </div>
          <button
            type="button"
            onClick={() => setContextOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div>
            <FieldLabel>Current Workspace</FieldLabel>
            <select
              value={contextValues.spaceId}
              onChange={(e) => {
                const val = e.target.value;
                setContextValue("spaceId", val);
                setContextValue("boardId", "");
                setContextValue("taskId", "");
                setActiveSpace(val);
              }}
              className="w-full rounded-xl border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 px-3 py-2 text-[12px] font-semibold text-slate-700 dark:text-slate-300 outline-none transition focus:border-indigo-400 cursor-pointer"
            >
              <option value="">Select Workspace...</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Current Board</FieldLabel>
            <select
              value={contextValues.boardId}
              onChange={(e) => {
                const val = e.target.value;
                setContextValue("boardId", val);
                setContextValue("taskId", "");
                setActiveBoard(val);
              }}
              disabled={!contextValues.spaceId}
              className="w-full rounded-xl border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 px-3 py-2 text-[12px] font-semibold text-slate-700 dark:text-slate-300 outline-none transition focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value="">Select Board...</option>
              {activeBoards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Focus Task</FieldLabel>
            <select
              value={contextValues.taskId}
              onChange={(e) => setContextValue("taskId", e.target.value)}
              disabled={!contextValues.boardId || tasksQuery.isLoading}
              className="w-full rounded-xl border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 px-3 py-2 text-[12px] font-semibold text-slate-700 dark:text-slate-300 outline-none transition focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {tasksQuery.isLoading ? (
                <option value="">Loading tasks...</option>
              ) : boardTasks.length === 0 ? (
                <option value="">No tasks available</option>
              ) : (
                <>
                  <option value="">Select Task...</option>
                  {boardTasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title || t.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <FieldLabel>Response Style</FieldLabel>
            <select
              value={contextValues.commentTone}
              onChange={(e) => setContextValue("commentTone", e.target.value)}
              className="w-full rounded-xl border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-955 px-3 py-2 text-[12px] font-semibold text-slate-700 dark:text-slate-300 outline-none transition focus:border-indigo-400 cursor-pointer"
            >
              {["professional", "friendly", "concise", "urgent"].map((tone) => (
                <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-6">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Recent Sessions</h3>
            {recentSessions.length === 0 ? (
              <div className="text-[11px] text-slate-400 p-2 text-center border border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-955/20">
                No recent conversations
              </div>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => loadSession(session.id)}
                    className="w-full rounded-xl border border-slate-150 dark:border-slate-800/80 bg-white dark:bg-slate-955 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-909 cursor-pointer shadow-sm"
                  >
                    <div className="text-[12px] font-bold text-slate-808 dark:text-slate-200 truncate">{session.title}</div>
                    <div className="mt-1 text-[10px] text-slate-400 font-semibold">{new Date(session.createdAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Framework Dashboard Workspace */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header - Spacious, borderless feel */}
        <header className="bg-white dark:bg-slate-900 px-6 py-5 border-b border-slate-100 dark:border-slate-800/60 shadow-[0_2px_8px_rgba(15,23,42,0.01)] shrink-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-tr from-indigo-500 to-indigo-400 text-white shadow-[0_8px_20px_rgba(99,102,241,0.2)]">
                <i className="fa-solid fa-sparkles text-md" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[20px] font-black tracking-[-0.04em] text-slate-900 dark:text-white">Mongez Intelligence</h1>
                  <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-400">
                    AI OS
                  </span>
                </div>
                <p className="text-[12px] text-slate-550 mt-0.5 font-medium">AI-driven workspace insights, approvals, workload capacities, and execution logs.</p>
              </div>
            </div>

            {/* Premium Tab bar navigation */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 dark:bg-slate-950/60 p-1 rounded-full border border-slate-202/50 dark:border-slate-808/50">
              {[
                { id: "overview", label: "Overview", icon: "fa-chart-pie" },
                { id: "actions", label: "Actions", icon: "fa-bolt-lightning" },
                { id: "approvals", label: "Approvals", icon: "fa-shield-halved" },
                { id: "insights", label: "Insights", icon: "fa-eye" },
                { id: "chat", label: "Chat Assistant", icon: "fa-comments" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all duration-150 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-250"
                  }`}
                >
                  <i className={`fa-solid ${tab.icon} text-[10px]`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sidebar toggle config button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setContextOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 px-4 py-2 text-[11px] font-bold text-slate-655 dark:text-slate-335 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-808 cursor-pointer"
              >
                <i className="fa-solid fa-sliders" />
                Context Setup
              </button>
            </div>
          </div>
        </header>

        {/* Outer body framework container */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {pageError && (
            <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50/50 dark:border-rose-900/20 dark:bg-rose-950/10 px-4 py-3 text-[12px] leading-relaxed text-rose-600 dark:text-rose-455 flex items-center justify-between">
              <span>{pageError}</span>
              <button onClick={() => setPageError("")} className="text-rose-400 hover:text-rose-600"><i className="fa-solid fa-xmark" /></button>
            </div>
          )}

          {/* Loader when pulling stats */}
          {dashboardLoading && (
            <div className="mb-6 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/10 px-4 py-2 text-[11px] font-bold text-indigo-500 animate-pulse flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin" />
              <span>Workspace Intelligence updating live...</span>
            </div>
          )}

          {/* OVERVIEW TAB: Redesigned Workspace Intelligence Center */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Metrics Grid */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboardLoading ? (
                  // Skeleton cards when loading
                  Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm border-none animate-pulse"
                    >
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
                      <div className="h-8 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  ))
                ) : (
                  // Actual metrics when loaded
                  [
                  { label: "Open Tasks", value: dashboardData.metrics.openTasks, color: "text-slate-900 dark:text-slate-100" },
                  { label: "Overdue Tasks", value: dashboardData.metrics.overdueTasks, color: dashboardData.metrics.overdueTasks > 0 ? "text-rose-600 dark:text-rose-455 font-black" : "text-slate-900 dark:text-slate-100", highlight: dashboardData.metrics.overdueTasks > 0 },
                  { label: "Blocked Tasks", value: dashboardData.metrics.blockedTasks, color: dashboardData.metrics.blockedTasks > 0 ? "text-amber-600 dark:text-amber-400 font-black" : "text-slate-900 dark:text-slate-100", highlight: dashboardData.metrics.blockedTasks > 0 },
                  { label: "Pending Approvals", value: dashboardData.metrics.pendingApprovals, color: "text-violet-600 dark:text-violet-405", sub: `${dashboardData.metrics.staleApprovals} stale >48h` },
                  { label: "High Risk Boards", value: dashboardData.metrics.highRiskProjects, color: dashboardData.metrics.highRiskProjects > 0 ? "text-rose-500" : "text-slate-900 dark:text-slate-100" },
                  { label: "Overloaded Members", value: dashboardData.metrics.overloadedMembers, color: "text-amber-505" },
                  { label: "Upcoming Deadlines", value: dashboardData.metrics.upcomingDeadlines, color: "text-sky-505" },
                  { label: "Meeting Actions", value: dashboardData.metrics.meetingActionsWaitingReview, color: "text-indigo-500" },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition duration-200 border-none ${
                      stat.highlight ? "ring-1 ring-rose-100 dark:ring-rose-955/20" : ""
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{stat.label}</span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-[26px] font-black tracking-tight ${stat.color}`}>{stat.value}</span>
                      {stat.sub && <span className="text-[10px] font-semibold text-slate-400">{stat.sub}</span>}
                    </div>
                  </div>
                )))}
              </section>

              {/* Action Center & Executive Feed Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AI Proposed Actions - Action Center */}
                <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                    <div>
                      <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">AI Action Center</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Approve or reject automated CQRS proposed tasks.</p>
                    </div>
                    <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-450">
                      {dashboardData.pendingActions.length} Pending
                    </span>
                  </div>

                  {dashboardData.pendingActions.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
                      <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-505 flex items-center justify-center mb-3">
                        <i className="fa-solid fa-circle-check text-lg" />
                      </div>
                      <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">Governance Clean</h4>
                      <p className="text-[11px] text-slate-400 max-w-xs mt-1">All proposed actions have been reviewed and executed.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[320px] pr-1">
                      {dashboardData.pendingActions.map((action) => (
                        <div key={action.id} className="rounded-2xl bg-slate-50 dark:bg-slate-955 p-4 border-none shadow-[0_2px_8px_rgba(15,23,42,0.01)]">
                          <div className="flex justify-between items-start gap-2">
                            <span className="rounded-full bg-slate-202 dark:bg-slate-850 px-2 py-0.5 text-[9px] font-bold text-slate-700 dark:text-slate-335 tracking-wide uppercase">
                              {action.commandType}
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold">{new Date(action.createdAt).toLocaleTimeString()}</span>
                          </div>
                          <p className="mt-2 text-[12px] font-bold text-slate-800 dark:text-slate-255 leading-relaxed">{action.reason}</p>
                          <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                            <button
                              type="button"
                              disabled={reviewingActionId === action.id}
                              onClick={() => void reviewFeedAction(action.id, "approve")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-55 cursor-pointer shadow-sm"
                            >
                              <i className="fa-solid fa-check" /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={reviewingActionId === action.id}
                              onClick={() => void reviewFeedAction(action.id, "reject")}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white dark:bg-slate-900 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-455 transition hover:bg-rose-55 dark:hover:bg-rose-955/20 disabled:opacity-55 cursor-pointer"
                            >
                              <i className="fa-solid fa-xmark" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Executive Feed - Activity Log */}
                <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                    <div>
                      <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">Executive Feed</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Real-time alerts, blockages, and capacity highlights.</p>
                    </div>
                    <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  </div>

                  <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[320px] pr-1">
                    {dashboardData.insights.map((item) => (
                      <div key={item.id} className="flex gap-3 items-start text-left">
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
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Workflow, Decisions & Meeting Intelligence Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Meeting Intelligence Widget */}
                <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                    <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">Recent Meeting Intelligence</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Analyzed transcripts with task extraction statistics.</p>
                  </div>

                  {dashboardData.meetingIntelligence.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-slate-400">
                      No analyzed meetings found in this space.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {dashboardData.meetingIntelligence.map((meeting) => (
                        <div key={meeting.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-955 rounded-2xl">
                          <div className="min-w-0">
                            <span className="text-[12px] font-bold text-slate-800 dark:text-slate-200 block truncate">{meeting.title}</span>
                            <span className="text-[9px] font-bold text-slate-400">{new Date(meeting.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-405">
                              {meeting.proposedTasksCount} Tasks Extracted
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setComposer(`Show details for meeting: ${meeting.title}`);
                                setActiveTab("chat");
                              }}
                              className="text-[11px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Decision Register Widget */}
                <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                    <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">Recent Decisions (Decision Register)</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Latest logs, outcomes, and justifications.</p>
                  </div>

                  {dashboardData.recentDecisions.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-slate-400">
                      No decision records resolved yet.
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
                <h2 className="text-[16px] font-black text-slate-900 dark:text-slate-100">AI Proposed Actions Log</h2>
                <p className="text-[12px] text-slate-550 mt-0.5">Automated task mutations, escalations, and messaging recommendations awaiting reviews.</p>
              </div>

              {dashboardData.pendingActions.length === 0 ? (
                <div className="py-12 text-center text-slate-405">
                  <i className="fa-solid fa-circle-check text-3xl text-emerald-400 mb-3" />
                  <p className="text-[13px] font-bold text-slate-700 dark:text-slate-350">All actions resolved</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Mongez workspace is fully aligned with governance parameters.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-850">
                  {dashboardData.pendingActions.map((action) => (
                    <div key={action.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-black text-slate-808 dark:text-slate-150">{action.commandType}</span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                            Pending Approval
                          </span>
                        </div>
                        <p className="text-[12.5px] leading-relaxed text-slate-650 dark:text-slate-400">{action.reason}</p>
                        <div className="text-[10px] font-bold text-slate-400">Proposed {new Date(action.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <button
                          type="button"
                          disabled={reviewingActionId === action.id}
                          onClick={() => void reviewFeedAction(action.id, "approve")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-[11px] font-bold text-white transition disabled:opacity-55 cursor-pointer shadow-sm"
                        >
                          <i className="fa-solid fa-check" /> Approve
                        </button>
                        <button
                          type="button"
                          disabled={reviewingActionId === action.id}
                          onClick={() => void reviewFeedAction(action.id, "reject")}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-white dark:bg-slate-900 px-4 py-2 text-[11px] font-bold text-rose-600 dark:text-rose-455 transition hover:bg-rose-50 dark:hover:bg-rose-955/20 disabled:opacity-55 cursor-pointer"
                        >
                          <i className="fa-solid fa-xmark" /> Reject
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Pending Approvals</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{dashboardData.metrics.pendingApprovals}</span>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Stale Approvals (&gt;48h)</span>
                  <span className={`text-3xl font-black ${dashboardData.metrics.staleApprovals > 0 ? "text-rose-500" : "text-slate-900 dark:text-slate-100"}`}>
                    {dashboardData.metrics.staleApprovals}
                  </span>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Escalated Notifications</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{dashboardData.metrics.meetingActionsWaitingReview}</span>
                </div>
              </section>

              <section className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="mb-4 pb-2 border-b border-slate-50 dark:border-slate-800/40">
                  <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">Active Workflow Queue</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Tasks, budget releases, and milestones locked behind workflow gates.</p>
                </div>

                {dashboardData.approvals.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    No active workflows require review.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-850">
                    {dashboardData.approvals.map((app) => (
                      <div key={app.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[12.5px] font-bold text-slate-850 dark:text-slate-200 block">{app.title}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">Started {new Date(app.startedAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {app.isStale && (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                              Stale &gt;48h
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
                    <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">Project Risks Analysis</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tasks currently blocked or past their due dates.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void triggerDirectScan("board_risk")}
                    disabled={Boolean(activeActionKey) || isStreaming}
                    className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955/20 px-3 py-1 rounded-full text-[10px] font-bold text-rose-600 dark:text-rose-455 cursor-pointer"
                  >
                    <i className={`fa-solid ${activeActionKey === "board_risk" ? "fa-spinner fa-spin" : "fa-shield-halved"}`} />
                    Deep Scan
                  </button>
                </div>

                {dashboardData.risks.length === 0 ? (
                  <div className="py-12 text-center text-slate-450">
                    🟢 No immediate blocked or overdue risks detected.
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
                          <span>Board: {risk.boardName}</span>
                          {risk.dueDate && (
                            <span className="text-rose-500">
                              Overdue: {new Date(risk.dueDate).toLocaleDateString()}
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
                  <h3 className="text-[14px] font-black text-slate-900 dark:text-slate-100">Team Workload Capacity</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Computed dynamically from historical completion rates.</p>
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
                      🟢 All assignees are currently within their calculated workload boundaries.
                    </div>
                  )}

                  <div className="rounded-2xl border border-dashed border-slate-150 dark:border-slate-808 bg-slate-50/50 dark:bg-slate-955/20 p-4 text-[11px] leading-relaxed text-slate-500 mt-4">
                    <strong>Capacity algorithm:</strong> Completion rate (completed tasks in status DONE) over the last 30 days is measured weekly and multiplied by 1.5. If active open tasks exceed this average, capacity is flagged.
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* CHAT TAB: Collapsed conversational intelligence console */}
          {activeTab === "chat" && (
            <div className="flex flex-1 flex-col overflow-hidden max-w-245 mx-auto bg-white dark:bg-slate-905 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-800/60 h-[580px] animate-fadeIn">
              {/* Messages container */}
              <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
                {filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10 max-w-md mx-auto h-full">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 shadow-[0_12px_24px_rgba(99,102,241,0.12)] mb-5">
                      <i className="fa-solid fa-sparkles text-xl animate-pulse" />
                    </div>
                    <h3 className="text-[16px] font-black text-slate-900 dark:text-slate-150">Workspace Chat Assistant</h3>
                    <p className="text-[12px] leading-relaxed text-slate-450 mt-1.5 mb-6">
                      Ask me to analyze project timelines, extract meeting highlights, or compile status summaries.
                    </p>

                    <div className="w-full space-y-2 text-left">
                      <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 pl-1 block mb-2">Workspace queries</span>
                      <div className="grid grid-cols-1 gap-2.5">
                        {quickPromptItems.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => void runChat(item.prompt)}
                            className="flex items-center gap-3 w-full rounded-2xl border border-slate-150 dark:border-slate-808 bg-white dark:bg-slate-900 p-3 text-left hover:border-indigo-400 hover:shadow-sm transition cursor-pointer"
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.accentClassName}`}>
                              <i className={`fa-solid ${item.icon} text-[11px]`} />
                            </div>
                            <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300 leading-normal">{item.label}</span>
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
                        <div key={message.id} className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"}`}>
                          {!isUser && (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-500">
                              <i className="fa-solid fa-robot text-xs" />
                            </div>
                          )}
                          <div className={`max-w-[85%] ${isUser ? "order-first" : ""}`}>
                            <ChatBubble
                              message={message}
                              feedbackState={message.traceId ? messageFeedback[message.traceId] : null}
                              onFeedback={(traceId, rating) => void handleMessageFeedback(traceId, rating)}
                              onRetry={handleRetry}
                            />
                          </div>
                          {isUser && (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-[11px] font-bold text-white uppercase shadow-sm">
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

              {/* Chat action control bar */}
              <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-955/20 border-t border-slate-100 dark:border-slate-800/40 flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-808 dark:text-slate-400 dark:hover:text-slate-205 shadow-sm cursor-pointer"
                >
                  <i className="fa-solid fa-rotate" />
                  Clear Session
                </button>
                <button
                  type="button"
                  onClick={() => void triggerDirectScan("report")}
                  disabled={Boolean(activeActionKey) || isStreaming}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-808 dark:text-slate-400 dark:hover:text-slate-205 shadow-sm disabled:cursor-not-allowed cursor-pointer"
                >
                  <i className="fa-solid fa-file-invoice" />
                  Generate Status Report
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ask Mongez Search Input bar - Rendered globally at the bottom */}
        <footer className="bg-white dark:bg-slate-900 px-6 py-4 border-t border-slate-100 dark:border-slate-800/60 shadow-[0_-4px_16px_rgba(15,23,42,0.01)] shrink-0">
          <div className="mx-auto w-full max-w-245">
            <div className="rounded-[24px] border border-slate-202/90 dark:border-slate-808 bg-slate-50 dark:bg-slate-955 p-2 shadow-sm transition focus-within:border-indigo-400">
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
                  placeholder="Ask Mongez Intelligence anything..."
                  className="min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-slate-750 dark:text-slate-350 outline-none placeholder:text-slate-400"
                />

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={() => chatAbortRef.current?.abort()}
                    className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 px-3 text-white transition cursor-pointer shadow-sm"
                    aria-label="Stop streaming response"
                  >
                    <i className="fa-solid fa-stop text-xs" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!composer.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white transition hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                    aria-label="Send message"
                  >
                    <i className="fa-solid fa-arrow-up text-xs" />
                  </button>
                )}
              </div>

              {/* Character counter */}
              <div className="flex justify-end px-2">
                <span
                  className={`text-[10px] font-bold ${
                    composer.length >= MAX_COMPOSER_LENGTH - 200
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {composer.length}/{MAX_COMPOSER_LENGTH}
                </span>
              </div>

              {/* Status Context Indicator line */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-2 border-t border-slate-100 dark:border-slate-850 pt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span className="rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2.5 py-1">
                  Space: {activeSpace?.name || "None"}
                </span>
                <span className="rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2.5 py-1">
                  Board: {activeBoard?.name || "None"}
                </span>
                {contextValues.taskId && (
                  <span className="rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2.5 py-1">
                    Task: {boardTasks.find(t => t.id === contextValues.taskId)?.title || "Selected"}
                  </span>
                )}
                <span className="rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2.5 py-1">
                  Tone: {contextValues.commentTone}
                </span>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <ToastContainer toasts={toasts} onClose={handleToastClose} />
    </div>
  );
}

function AiAssistantPageWithErrorBoundary(props) {
  return (
    <ErrorBoundary fallbackMessage="The Mongez Intelligence page encountered a layout error. Please refresh.">
      <AiAssistantPage {...props} />
    </ErrorBoundary>
  );
}

export default AiAssistantPageWithErrorBoundary;
