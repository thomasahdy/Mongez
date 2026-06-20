import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  analyzeRisk,
  extractTextFromPayload,
  fetchPendingAiActions,
  generateAiReport,
  sendAiChat,
  streamAiChat,
} from "../../lib/aiApi";
import { useAppContext } from "../AppContext";

const breadcrumbPath = [
  { name: "Al-Noor Foundation", color: "text-slate-400", ref: "" },
  { name: "AI Assistant", color: "text-slate-800", ref: "" },
];

const STORAGE_KEYS = {
  context: "mongez.ai.context",
  sessions: "mongez.ai.sessions",
};

const quickPrompts = [
  {
    label: "Sprint summary",
    icon: "fa-chart-bar",
    accentClassName: "text-sky-500",
    prompt: "Summarize the current sprint and highlight the deadlines most likely to slip.",
  },
  {
    label: "Overdue tasks",
    icon: "fa-triangle-exclamation",
    accentClassName: "text-amber-500",
    prompt: "List overdue tasks, grouped by urgency, and tell me which ones need escalation first.",
  },
  {
    label: "Create tasks from brief",
    icon: "fa-clipboard-list",
    accentClassName: "text-cyan-500",
    prompt: "Turn this brief into a prioritized task list with owners, dependencies, and deadlines.",
  },
  {
    label: "Team workload",
    icon: "fa-users",
    accentClassName: "text-indigo-500",
    prompt: "Analyze team workload and suggest where blocked work can be reassigned safely.",
  },
  {
    label: "Risk assessment",
    icon: "fa-shield-halved",
    accentClassName: "text-rose-500",
    prompt: "Give me a risk assessment for the active workspace with the biggest blockers and the fastest mitigation steps.",
  },
];

const endpointActions = [
  { key: "board", label: "Risk Scan (Board)", icon: "fa-chalkboard", helper: "POST /api/v1/ai/risk/analyze" },
  { key: "task", label: "Risk Scan (Task)", icon: "fa-list-check", helper: "POST /api/v1/ai/risk/analyze" },
  { key: "report", label: "Generate Report", icon: "fa-file-lines", helper: "POST /api/v1/ai/report/generate" },
];

const toneOptions = ["professional", "friendly", "concise", "urgent"];

const welcomeMessage = {
  id: "welcome-message",
  role: "assistant",
  kind: "welcome",
  text: "Connected to POST /ai/chat and /ai/chat/stream. Set space and board context, then ask questions or run risk scans.",
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
    // Ignore storage failures and keep the page usable.
  }
}

function truncateText(text, maxLength = 72) {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeFeedItems(payload) {
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.insights)
          ? payload.insights
          : [];

  return rawItems.map((item, index) => ({
    id: item.id || item._id || item.uuid || `feed-${index}`,
    title: item.title || item.name || item.headline || item.type || `Insight ${index + 1}`,
    summary: item.summary || item.message || item.description || extractTextFromPayload(item) || "No summary provided.",
    severity: item.severity || item.priority || item.level || "info",
    source: item.source || item.category || "AI Feed",
    timestamp: item.createdAt || item.timestamp || item.generatedAt || item.date || "",
  }));
}

function toChatPayloadMessages(messages) {
  return messages
    .filter((message) => message.kind === "text" && (message.role === "user" || message.role === "assistant"))
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));
}

function formatApiResult(payload) {
  const extractedText = extractTextFromPayload(payload);

  if (extractedText) {
    return extractedText;
  }

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

function FieldLabel({ children }) {
  return <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{children}</label>;
}

function ContextPanelContent({
  contextValues,
  onContextChange,
  quickPromptItems,
  recentSessions,
  onQuickPrompt,
  onLoadSession,
  feedItems,
  feedLoading,
  feedError,
  onRefreshFeed,
  sectionRef,
  onCloseMobile,
}) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between xl:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assistant</p>
          <h2 className="text-[18px] font-black tracking-[-0.04em] text-slate-900">AI Context</h2>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500"
          aria-label="Close context panel"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Endpoint Context</div>
        <div className="space-y-3">
          <div>
            <FieldLabel>Space ID</FieldLabel>
            <input
              value={contextValues.spaceId}
              onChange={(event) => onContextChange("spaceId", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
              placeholder="Required for AI endpoints"
            />
          </div>
          <div>
            <FieldLabel>Board ID</FieldLabel>
            <input
              value={contextValues.boardId}
              onChange={(event) => onContextChange("boardId", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
              placeholder="Optional board context"
            />
          </div>
          <div>
            <FieldLabel>Task ID</FieldLabel>
            <input
              value={contextValues.taskId}
              onChange={(event) => onContextChange("taskId", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
              placeholder="Optional task context"
            />
          </div>
          <div>
            <FieldLabel>Comment Tone</FieldLabel>
            <select
              value={contextValues.commentTone}
              onChange={(event) => onContextChange("commentTone", event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
            >
              {toneOptions.map((tone) => (
                <option key={tone} value={tone}>
                  {tone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Quick Prompts</div>
        <div className="flex flex-wrap gap-2">
          {quickPromptItems.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => onQuickPrompt(prompt.prompt)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition-all duration-200 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            >
              <i className={`fa-solid ${prompt.icon} ${prompt.accentClassName}`} />
              {prompt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Pending AI Actions</div>
          <button
            type="button"
            onClick={onRefreshFeed}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
          >
            <i className={`fa-solid ${feedLoading ? "fa-spinner fa-spin" : "fa-rotate-right"}`} />
            Refresh
          </button>
        </div>

        {!contextValues.spaceId && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-[12px] leading-5 text-slate-500">
            Add a `spaceId` to load `GET /api/v1/ai/actions/pending`.
          </div>
        )}

        {contextValues.spaceId && feedError && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[12px] leading-5 text-rose-600">
            {feedError}
          </div>
        )}

        {contextValues.spaceId && !feedError && !feedItems.length && !feedLoading && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3 text-[12px] leading-5 text-slate-500">
            No feed items were returned for this space yet.
          </div>
        )}

        {feedItems.length > 0 && (
          <div className="space-y-2">
            {feedItems.map((item) => (
              <article key={item.id} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
                    {item.severity}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.source}</span>
                </div>
                <h3 className="mt-2 text-[13px] font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-[12px] leading-5 text-slate-600">{item.summary}</p>
                {item.timestamp && <p className="mt-2 text-[10px] text-slate-400">{item.timestamp}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section ref={sectionRef} className="min-h-0 flex-1">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Recent Sessions</div>
        <div className="space-y-2">
          {recentSessions.length === 0 && (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-5 text-slate-500">
              Your actual local chat history will appear here after you start using the assistant.
            </div>
          )}

          {recentSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onLoadSession(session.id)}
              className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="text-[13px] font-semibold text-slate-900">{session.title}</div>
              <div className="mt-1 text-[12px] text-slate-500">{new Date(session.createdAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChatBubble({ message }) {
  if (message.kind === "welcome") {
    return (
      <div className="rounded-3xl rounded-tl-md border border-slate-200 bg-white px-5 py-4 text-[13px] leading-6 text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <p className="text-slate-900">{message.text}</p>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="rounded-3xl rounded-tr-md bg-slate-900 px-5 py-4 text-[13px] leading-6 whitespace-pre-wrap text-white shadow-[0_20px_40px_rgba(15,23,42,0.18)]">
        {message.text}
      </div>
    );
  }

  return (
    <div className="rounded-3xl rounded-tl-md border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      {message.label && (
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <i className={`fa-solid ${message.icon || "fa-sparkles"} text-indigo-500`} />
          <span>{message.label}</span>
        </div>
      )}

      <div className="text-[13px] leading-6 whitespace-pre-wrap text-slate-700">
        {message.text || (message.loading ? "Thinking…" : "")}
      </div>

      {message.error && <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-[12px] text-rose-600">{message.error}</div>}
    </div>
  );
}

function AiAssistantPage() {
  const { setPath } = useOutletContext();
  const { activeSpace, activeBoard, spaces, user } = useAppContext();
  const [composer, setComposer] = useState("");
  const [desktopContextCollapsed, setDesktopContextCollapsed] = useState(false);
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
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
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [pageError, setPageError] = useState("");
  const [activeActionKey, setActiveActionKey] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mobileHistoryRef = useRef(null);
  const desktopHistoryRef = useRef(null);
  const chatAbortRef = useRef(null);

  const chatContext = useMemo(
    () => ({
      spaceId: contextValues.spaceId || undefined,
      boardId: contextValues.boardId || undefined,
      taskId: contextValues.taskId || undefined,
    }),
    [contextValues.boardId, contextValues.spaceId, contextValues.taskId],
  );

  useEffect(() => {
    setContextValues((current) => ({
      ...current,
      spaceId: current.spaceId || activeSpace?.id || spaces[0]?.id || "",
      boardId: current.boardId || activeBoard?.id || "",
    }));
  }, [activeSpace?.id, activeBoard?.id, spaces]);

  useEffect(() => {
    setPath?.([
      { name: activeSpace?.name || "Workspace", color: "text-slate-400", ref: "/spaces" },
      { name: "AI Assistant", color: "text-slate-800", ref: "" },
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

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [composer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const persistCurrentSession = (nextMessages) => {
    const realMessages = nextMessages.filter((message) => message.kind !== "welcome");

    if (realMessages.length === 0) {
      return;
    }

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

  const loadFeed = async () => {
    if (!contextValues.spaceId.trim()) {
      setFeedItems([]);
      setFeedError("");
      return;
    }

    setFeedLoading(true);
    setFeedError("");

    try {
      const payload = await fetchPendingAiActions(contextValues.spaceId.trim());
      setFeedItems(normalizeFeedItems(payload));
    } catch (error) {
      setFeedItems([]);
      setFeedError(error.message || "Failed to load the AI feed.");
    } finally {
      setFeedLoading(false);
    }
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
    };

    setMessages((currentMessages) => {
      const nextMessages = [...currentMessages, assistantMessage];
      persistCurrentSession(nextMessages);
      return nextMessages;
    });
  };

  const runChat = async (prompt) => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt || isStreaming) {
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
      label: "Streaming Chat",
      icon: "fa-sparkles",
      loading: true,
      error: "",
    };

    const baseMessages = [...messages, userMessage];
    const nextMessages = [...baseMessages, assistantPlaceholder];
    setMessages(nextMessages);
    setPageError("");
    setIsStreaming(true);
    setComposer("");

    const abortController = new AbortController();
    chatAbortRef.current = abortController;

    try {
      const { text } = await streamAiChat({
        message: trimmedPrompt,
        spaceId: chatContext.spaceId,
        boardId: chatContext.boardId,
        taskId: chatContext.taskId,
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
                text: message.text || text || "The assistant finished without returning any text.",
                loading: false,
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
              ? {
                  ...message,
                  loading: false,
                  error: "Response stopped.",
                }
              : message,
          );
          persistCurrentSession(abortedMessages);
          return abortedMessages;
        });
      } else {
        const errorMessage = error.message || "The AI chat request failed.";
        setPageError(errorMessage);
        setMessages((currentMessages) => {
          const failedMessages = currentMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  loading: false,
                  error: errorMessage,
                  text: message.text || "",
                }
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

  const runAction = async (actionKey) => {
    setActiveActionKey(actionKey);
    setPageError("");

    try {
      if (actionKey === "board") {
        if (!contextValues.spaceId.trim()) {
          throw new Error("Add a space ID before requesting board risk analysis.");
        }

        const payload = await analyzeRisk({
          spaceId: contextValues.spaceId.trim(),
          boardId: contextValues.boardId.trim() || undefined,
        });
        appendAssistantResult("Board Risk Scan", formatApiResult(payload), { icon: "fa-chalkboard" });
      }

      if (actionKey === "task") {
        if (!contextValues.taskId.trim()) {
          throw new Error("Add a task ID before requesting task risk analysis.");
        }

        const payload = await analyzeRisk({
          spaceId: contextValues.spaceId.trim() || undefined,
          boardId: contextValues.boardId.trim() || undefined,
          taskId: contextValues.taskId.trim(),
        });
        appendAssistantResult("Task Risk Scan", formatApiResult(payload), { icon: "fa-list-check" });
      }

      if (actionKey === "report") {
        if (!contextValues.spaceId.trim()) {
          throw new Error("Add a space ID before generating a report.");
        }

        const payload = await generateAiReport({
          spaceId: contextValues.spaceId.trim(),
          boardId: contextValues.boardId.trim() || undefined,
          reportType: "weekly",
        });
        appendAssistantResult("AI Report", formatApiResult(payload), { icon: "fa-file-lines" });
      }
    } catch (error) {
      setPageError(error.message || "The AI action failed.");
    } finally {
      setActiveActionKey("");
    }
  };

  const handleSubmit = () => {
    void runChat(composer);
  };

  const handleNewChat = () => {
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
    }

    setCurrentSessionId(makeId("session"));
    setMessages([welcomeMessage]);
    setComposer("");
    setPageError("");
  };

  const loadSession = (sessionId) => {
    const session = recentSessions.find((item) => item.id === sessionId);

    if (!session) {
      return;
    }

    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setContextValues(session.context || contextValues);
    setMobileContextOpen(false);
  };

  const handleHistoryClick = () => {
    setDesktopContextCollapsed(false);
    setMobileContextOpen(true);

    setTimeout(() => {
      desktopHistoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      mobileHistoryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  return (
    <div className="relative flex flex-1 overflow-hidden bg-slate-50">
      {mobileContextOpen && (
        <button
          type="button"
          aria-label="Close context panel backdrop"
          onClick={() => setMobileContextOpen(false)}
          className="absolute inset-0 z-20 bg-slate-900/20 backdrop-blur-[1px] xl:hidden"
        />
      )}

      <aside
        className={`absolute inset-y-0 left-0 z-30 w-85 max-w-[88vw] border-r border-slate-200 bg-slate-50 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-transform duration-300 xl:hidden ${
          mobileContextOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ContextPanelContent
          contextValues={contextValues}
          onContextChange={setContextValue}
          quickPromptItems={quickPrompts}
          recentSessions={recentSessions}
          onQuickPrompt={(prompt) => {
            void runChat(prompt);
            setMobileContextOpen(false);
          }}
          onLoadSession={loadSession}
          feedItems={feedItems}
          feedLoading={feedLoading}
          feedError={feedError}
          onRefreshFeed={() => void loadFeed()}
          sectionRef={mobileHistoryRef}
          onCloseMobile={() => setMobileContextOpen(false)}
        />
      </aside>

      <aside
        className={`hidden border-r border-slate-200 bg-slate-50 transition-all duration-300 xl:flex ${
          desktopContextCollapsed ? "w-0 overflow-hidden border-r-0 opacity-0" : "w-85 shrink-0 p-5 opacity-100"
        }`}
      >
        {!desktopContextCollapsed && (
          <ContextPanelContent
            contextValues={contextValues}
            onContextChange={setContextValue}
            quickPromptItems={quickPrompts}
            recentSessions={recentSessions}
            onQuickPrompt={(prompt) => void runChat(prompt)}
            onLoadSession={loadSession}
            feedItems={feedItems}
            feedLoading={feedLoading}
            feedError={feedError}
            onRefreshFeed={() => void loadFeed()}
            sectionRef={desktopHistoryRef}
            onCloseMobile={() => {}}
          />
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[radial-gradient(circle_at_top,#eef2ff,#e0f2fe)] text-indigo-500 shadow-[0_14px_35px_rgba(99,102,241,0.12)]">
                <i className="fa-solid fa-sparkles text-lg" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[24px] font-black tracking-[-0.04em] text-slate-900">Mongez AI</h1>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-500">
                    Live API
                  </span>
                </div>
                <p className="text-[13px] text-slate-500">Streaming chat, risk scans, and reports using the AI API.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileContextOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 xl:hidden"
              >
                <i className="fa-solid fa-sidebar" />
                Context
              </button>
              <button
                type="button"
                onClick={() => setDesktopContextCollapsed((collapsed) => !collapsed)}
                className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 xl:inline-flex"
              >
                <i className="fa-solid fa-sidebar" />
                Context
              </button>
              <button
                type="button"
                onClick={handleHistoryClick}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
              >
                <i className="fa-solid fa-clock-rotate-left" />
                History
              </button>
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                <i className="fa-solid fa-plus" />
                New Chat
              </button>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-slate-200 bg-white/90 px-4 py-3 sm:px-5">
            <div className="mx-auto flex max-w-245 flex-wrap gap-2">
              {endpointActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => void runAction(action.key)}
                  disabled={Boolean(activeActionKey) || isStreaming}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-[12px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  title={action.helper}
                >
                  <i className={`fa-solid ${activeActionKey === action.key ? "fa-spinner fa-spin" : action.icon}`} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
            <div className="mx-auto flex w-full max-w-245 flex-col gap-5">
              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div key={message.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#eef2ff,#dbeafe)] text-indigo-500 shadow-[0_12px_30px_rgba(99,102,241,0.14)]">
                        <i className={`fa-solid ${message.kind === "welcome" ? "fa-sparkles" : "fa-robot"} text-[13px]`} />
                      </div>
                    )}

                    <div className={`max-w-195 ${isUser ? "order-first" : ""}`}>
                      <ChatBubble message={message} />
                    </div>

                    {isUser && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-[12px] font-bold text-white shadow-[0_12px_30px_rgba(14,165,233,0.18)]">
                        {(user?.name || user?.email || "U").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
            <div className="mx-auto w-full max-w-245">
              {pageError && (
                <div className="mb-3 rounded-[22px] border border-rose-100 bg-rose-50 px-4 py-3 text-[12px] leading-5 text-rose-600">
                  {pageError}
                </div>
              )}

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Ask Mongez AI anything, or write context here before using Draft Comment..."
                    className="min-h-12 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-[14px] leading-6 text-slate-700 outline-none placeholder:text-slate-400"
                  />

                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => chatAbortRef.current?.abort()}
                      className="flex h-11 min-w-11 items-center justify-center rounded-2xl bg-rose-500 px-3 text-white transition-colors hover:bg-rose-600"
                      aria-label="Stop streaming response"
                    >
                      <i className="fa-solid fa-stop" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white transition-colors hover:bg-sky-600"
                      aria-label="Send message"
                    >
                      <i className="fa-solid fa-arrow-up" />
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                    `spaceId`: {contextValues.spaceId || "not set"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                    `boardId`: {contextValues.boardId || "not set"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                    `taskId`: {contextValues.taskId || "not set"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                    Tone: {contextValues.commentTone}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AiAssistantPage;
