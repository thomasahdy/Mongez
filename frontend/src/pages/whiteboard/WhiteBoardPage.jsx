import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router";
import { useAppContext } from "../AppContext";
import { formatSavedAt, useWhiteboardScene } from "../../hooks/useWhiteboardScene";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

function getSafeAppState(appState) {
  const safeAppState = appState && typeof appState === "object" ? { ...appState } : {};
  safeAppState.collaborators = new Map();
  return safeAppState;
}

export default function WhiteBoardPage() {
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
      { name: "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: activeBoard?.name || "Whiteboard", color: "text-slate-800", ref: "" },
    ]);
  }, [setPath, activeBoard?.name]);

  useEffect(() => {
    if (!activeBoard?.id) {
      setStatusMessage("No active board selected. A local fallback whiteboard is active in this browser.");
    }
  }, [activeBoard?.id, setStatusMessage]);

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
      setStatusMessage("Nothing is loaded to export yet.");
      return;
    }

    const payload = {
      ...latestSceneRef.current,
      updatedAt: latestSavedAtRef.current || new Date().toISOString(),
      boardId: activeBoard?.id || null,
      boardName: activeBoard?.name || "Whiteboard",
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(activeBoard?.name || "whiteboard").replace(/\s+/g, "-").toLowerCase()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    setStatusMessage("Whiteboard exported as JSON.");
  };

  const handleClearBoard = () => {
    if (!window.confirm("Reset the current whiteboard? This removes the local snapshot for this board in this browser.")) {
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
      setStatusMessage("Import failed. Use a JSON export smaller than 5 MB.");
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
          ...getSafeAppState(parsed.appState),
        },
        files: parsed.files || {},
      };

      excalidrawApiRef.current?.updateScene(nextScene);
      latestSceneRef.current = nextScene;
      persistScene(nextScene.elements, nextScene.appState, nextScene.files);
      setLastSavedAt(latestSavedAtRef.current);
      setStatusMessage("Whiteboard imported successfully.");
    } catch {
      setStatusMessage("Import failed. Use a valid exported whiteboard JSON file.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-body)]">
      <main className="mx-auto flex w-full max-w-350 flex-1 flex-col overflow-hidden px-5 py-4">
        <section className="mb-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-500">Whiteboard</p>
              <h1 className="mt-1 text-[24px] font-black tracking-[-0.05em] text-slate-900">
                {activeBoard?.name || "Workspace whiteboard"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                This board is persisted locally per workspace board. Import and export are available, but server persistence is not wired yet.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleImportClick}
                disabled={isImporting}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
              >
                {isImporting ? "Importing..." : "Import JSON"}
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-600"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleClearBoard}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Reset board
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
            <div className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">
              {formatSavedAt(lastSavedAt)}
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700">
              {statusMessage}
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
