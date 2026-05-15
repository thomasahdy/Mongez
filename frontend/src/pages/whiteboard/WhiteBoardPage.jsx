import { useCallback, useMemo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

const WHITEBOARD_STORAGE_KEY = "mongez-whiteboard-scene";

function getSafeAppState(appState) {
  const safeAppState = appState && typeof appState === "object" ? { ...appState } : {};
  safeAppState.collaborators = new Map();
  return safeAppState;
}

function WhiteBoardPage() {
  const initialData = useMemo(() => {
    try {
      const saved = localStorage.getItem(WHITEBOARD_STORAGE_KEY);
      if (!saved) {
        return { appState: { viewBackgroundColor: "#f8fafc" } };
      }
      const parsed = JSON.parse(saved);
      return {
        elements: parsed.elements || [],
        appState: {
          viewBackgroundColor: "#f8fafc",
          ...getSafeAppState(parsed.appState),
        },
        files: parsed.files || {},
      };
    } catch {
      return { appState: { viewBackgroundColor: "#f8fafc" } };
    }
  }, []);

  const handleSceneChange = useCallback((elements, appState, files) => {
    try {
      const payload = JSON.stringify({
        elements,
        appState: getSafeAppState(appState),
        files,
      });
      localStorage.setItem(WHITEBOARD_STORAGE_KEY, payload);
    } catch {
      // Silently fail — storage might be full
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f7fb]">
      <main className="flex-1 overflow-hidden mx-auto w-full max-w-[1400px] px-5 py-4">
        <section className="h-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_55px_rgba(15,23,42,0.1)]">
          <Excalidraw
            initialData={initialData}
            onChange={handleSceneChange}
            theme="light"
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: true,
                clearCanvas: true,
                export: { saveFileToDisk: true },
                loadScene: true,
                saveToActiveFile: false,
                toggleTheme: false,
              },
            }}
          />
        </section>
      </main>
    </div>
  );
}

export default WhiteBoardPage;