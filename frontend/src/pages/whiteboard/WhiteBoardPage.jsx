import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../AppContext";
import {
  formatSavedAt,
  sanitizeWhiteboardAppState,
  useWhiteboardScene,
} from "../../hooks/useWhiteboardScene";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export default function WhiteBoardPage() {
  const { t, i18n } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const { setPath } = useOutletContext() || {};
  const { activeBoard } = useAppContext();
  const fileInputRef = useRef(null);
  const excalidrawApiRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const {
    storageKey,
    loadedScene,
    lastSavedAt,
    setLastSavedAt,
    statusMessage,
    setStatusMessage,
    latestSceneRef,
    latestSavedAtRef,
    persistScene,
    resetScene,
  } = useWhiteboardScene(activeBoard?.id);
  const locale = i18n.language?.startsWith("ar") ? "ar-EG" : "en-US";
  const uiOptions = useMemo(
    () => ({
      canvasActions: {
        changeViewBackgroundColor: true,
        clearCanvas: true,
        export: { saveFileToDisk: true },
        loadScene: true,
        saveToActiveFile: false,
        toggleTheme: false,
      },
    }),
    [],
  );

  useEffect(() => {
    setPath?.([
      { name: t("common.workspace"), color: "text-slate-400", ref: "/dashboard" },
      { name: activeBoard?.name || t("whiteboard.boardFallback"), color: "text-slate-800", ref: "" },
    ]);
  }, [activeBoard?.name, setPath, t]);

  useEffect(() => {
    if (!activeBoard?.id) {
      setStatusMessage(t("whiteboard.statuses.noActiveBoard"));
    }
  }, [activeBoard?.id, setStatusMessage, t]);

  const handleSceneChange = useCallback(
    (elements, appState, files) => {
      persistScene(elements, appState, files);
    },
    [persistScene],
  );

  const handleExcalidrawApi = useCallback((api) => {
    excalidrawApiRef.current = api;
  }, []);

  const handleExportJson = () => {
    if (!latestSceneRef.current) {
      setStatusMessage(t("whiteboard.statuses.nothingToExport"));
      return;
    }

    const payload = {
      ...latestSceneRef.current,
      updatedAt: latestSavedAtRef.current || new Date().toISOString(),
      boardId: activeBoard?.id || null,
      boardName: activeBoard?.name || t("whiteboard.title"),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeBoard?.name || "whiteboard").replace(/\s+/g, "-").toLowerCase()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    setStatusMessage(t("whiteboard.statuses.exported"));
  };

  const handleClearBoard = () => {
    if (!window.confirm(t("whiteboard.statuses.confirmReset"))) {
      return;
    }

    const emptyScene = resetScene();
    excalidrawApiRef.current?.updateScene(emptyScene);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > MAX_IMPORT_BYTES) {
      setStatusMessage(t("whiteboard.statuses.importTooLarge"));
      event.target.value = "";
      return;
    }

    setIsImporting(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.elements)) {
        throw new Error("Invalid scene payload.");
      }
      const nextScene = {
        elements: Array.isArray(parsed.elements) ? parsed.elements : [],
        appState: {
          viewBackgroundColor: "#f8fafc",
          ...sanitizeWhiteboardAppState(parsed.appState),
        },
        files: parsed.files || {},
      };

      excalidrawApiRef.current?.updateScene(nextScene);
      latestSceneRef.current = nextScene;
      persistScene(nextScene.elements, nextScene.appState, nextScene.files);
      setLastSavedAt(latestSavedAtRef.current);
      setStatusMessage(t("whiteboard.statuses.importSuccess"));
    } catch {
      setStatusMessage(t("whiteboard.statuses.importFailed"));
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-body)]" dir={isRTL ? "rtl" : "ltr"}>
      <main className="mx-auto flex w-full max-w-350 flex-1 flex-col overflow-hidden px-5 py-4">
        <section className="mb-4 rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${isRTL ? "lg:flex-row-reverse" : ""}`}>
            <div>
              <p className="text-[18px] font-black uppercase tracking-[0.18em] text-sky-500">{t("whiteboard.title")}</p>
         
              <div className={`mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400 ${isRTL ? "flex-row-reverse" : ""}`}>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-500">
                  {formatSavedAt(lastSavedAt, t, locale)}
                </span>
                {statusMessage ? <span>{statusMessage}</span> : null}
              </div>
            </div>

            <div className={`flex flex-wrap gap-2 ${isRTL ? "justify-end" : ""}`}>
              <button
                type="button"
                onClick={handleImportClick}
                disabled={isImporting}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
              >
                {isImporting ? t("whiteboard.importing") : t("whiteboard.importJson")}
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
              >
                {t("whiteboard.exportJson")}
              </button>
              <button
                type="button"
                onClick={handleClearBoard}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t("whiteboard.resetBoard")}
              </button>
            </div>
          </div>


        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
        />

        <section className="h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_55px_rgba(15,23,42,0.1)]">
          <Excalidraw
            key={storageKey}
            initialData={loadedScene}
            onChange={handleSceneChange}
            excalidrawAPI={handleExcalidrawApi}
            theme="light"
            UIOptions={uiOptions}
          />
        </section>
      </main>
    </div>
  );
}
