import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getSafeAppState(appState) {
  const safeAppState = appState && typeof appState === "object" ? { ...appState } : {};
  safeAppState.collaborators = new Map();
  return safeAppState;
}

function createEmptyScene() {
  return {
    elements: [],
    appState: { viewBackgroundColor: "#f8fafc" },
    files: {},
  };
}

function loadScene(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);

    if (!saved) {
      return {
        scene: createEmptyScene(),
        updatedAt: "",
      };
    }

    const parsed = JSON.parse(saved);
    return {
      scene: {
        elements: parsed.elements || [],
        appState: {
          viewBackgroundColor: "#f8fafc",
          ...getSafeAppState(parsed.appState),
        },
        files: parsed.files || {},
      },
      updatedAt: parsed.updatedAt || "",
    };
  } catch {
    return {
      scene: createEmptyScene(),
      updatedAt: "",
    };
  }
}

export function formatSavedAt(value) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved locally";
  }

  return `Saved locally ${date.toLocaleString()}`;
}

export function useWhiteboardScene(boardId) {
  const storageKey = useMemo(() => `mongez-whiteboard-scene:${boardId || "global"}`, [boardId]);
  const loadedScene = useMemo(() => loadScene(storageKey), [storageKey]);
  const [lastSavedAt, setLastSavedAt] = useState(() => loadedScene.updatedAt);
  const [statusMessage, setStatusMessage] = useState("Board-scoped autosave is active.");
  const latestSceneRef = useRef(loadedScene.scene);
  const latestSavedAtRef = useRef(loadedScene.updatedAt);

  useEffect(() => {
    latestSceneRef.current = loadedScene.scene;
    latestSavedAtRef.current = loadedScene.updatedAt;
    setLastSavedAt(loadedScene.updatedAt);
    setStatusMessage("Board-scoped autosave is active.");
  }, [loadedScene.scene, loadedScene.updatedAt]);

  const persistScene = useCallback(
    (elements, appState, files) => {
      try {
        const updatedAt = new Date().toISOString();
        const nextScene = {
          elements,
          appState: getSafeAppState(appState),
          files,
        };

        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...nextScene,
            updatedAt,
          }),
        );

        latestSceneRef.current = nextScene;
        latestSavedAtRef.current = updatedAt;
        setLastSavedAt(updatedAt);
      } catch {
        setStatusMessage("Local save failed in this browser, but drawing remains available.");
      }
    },
    [storageKey],
  );

  const resetScene = useCallback(() => {
    const emptyScene = createEmptyScene();
    localStorage.removeItem(storageKey);
    latestSceneRef.current = emptyScene;
    latestSavedAtRef.current = "";
    setLastSavedAt("");
    setStatusMessage("Board cleared. Local snapshot removed.");
    return emptyScene;
  }, [storageKey]);

  return {
    storageKey,
    loadedScene: loadedScene.scene,
    lastSavedAt,
    setLastSavedAt,
    statusMessage,
    setStatusMessage,
    latestSceneRef,
    latestSavedAtRef,
    persistScene,
    resetScene,
  };
}
