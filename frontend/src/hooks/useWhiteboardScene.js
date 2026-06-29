import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { readStorageJson, removeStorageValue, writeStorageJson } from "../utils/browserStorage";

export function sanitizeWhiteboardAppState(appState) {
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
  const parsed = readStorageJson(storageKey, null);

  if (!parsed) {
    return {
      scene: createEmptyScene(),
      updatedAt: "",
    };
  }

  return {
    scene: {
      elements: parsed.elements || [],
      appState: {
        viewBackgroundColor: "#f8fafc",
        ...sanitizeWhiteboardAppState(parsed.appState),
      },
      files: parsed.files || {},
    },
    updatedAt: parsed.updatedAt || "",
  };
}

export function formatSavedAt(value, t, locale = "en-US") {
  if (!value) {
    return t("whiteboard.savedAt.notSavedYet");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t("whiteboard.savedAt.local");
  }

  return t("whiteboard.savedAt.savedOn", {
    date: date.toLocaleString(locale),
  });
}

export function useWhiteboardScene(boardId) {
  const { t } = useTranslation();
  const storageKey = useMemo(() => `mongez-whiteboard-scene:${boardId || "global"}`, [boardId]);
  const loadedScene = useMemo(() => loadScene(storageKey), [storageKey]);
  const [lastSavedAt, setLastSavedAt] = useState(() => loadedScene.updatedAt);
  const [statusMessage, setStatusMessage] = useState(() => t("whiteboard.statuses.autosaveActive"));
  const latestSceneRef = useRef(loadedScene.scene);
  const latestSavedAtRef = useRef(loadedScene.updatedAt);

  useEffect(() => {
    latestSceneRef.current = loadedScene.scene;
    latestSavedAtRef.current = loadedScene.updatedAt;
    setLastSavedAt(loadedScene.updatedAt);
    setStatusMessage(t("whiteboard.statuses.autosaveActive"));
  }, [loadedScene.scene, loadedScene.updatedAt, t]);

  const persistScene = useCallback(
    (elements, appState, files) => {
      try {
        const updatedAt = new Date().toISOString();
        const nextScene = {
          elements,
          appState: sanitizeWhiteboardAppState(appState),
          files,
        };

        const saved = writeStorageJson(storageKey, {
          ...nextScene,
          updatedAt,
        });

        if (!saved) {
          throw new Error("Unable to persist whiteboard scene.");
        }

        latestSceneRef.current = nextScene;
        latestSavedAtRef.current = updatedAt;
        setLastSavedAt(updatedAt);
      } catch {
        setStatusMessage(t("whiteboard.statuses.saveFailed"));
      }
    },
    [storageKey, t],
  );

  const resetScene = useCallback(() => {
    const emptyScene = createEmptyScene();
    removeStorageValue(storageKey);
    latestSceneRef.current = emptyScene;
    latestSavedAtRef.current = "";
    setLastSavedAt("");
    setStatusMessage(t("whiteboard.statuses.cleared"));
    return emptyScene;
  }, [storageKey, t]);

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
