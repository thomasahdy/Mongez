import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getBoard,
  getDepartmentBoards,
  getSpaceDepartments,
  getSpaceMembers,
  getSpaces,
  setActiveSpaceSession,
} from "../lib/pageApi";
import authService from "../services/auth.service";

const ACTIVE_SPACE_STORAGE_KEY = "mongez.activeSpaceId";
const ACTIVE_BOARD_STORAGE_KEY = "mongez.activeBoardId";

const AppContext = createContext(null);

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage issues.
  }
}

function flattenBoards(boardsByDepartment) {
  return Object.values(boardsByDepartment).flat();
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [spaceMembers, setSpaceMembers] = useState([]);
  const [departmentsBySpace, setDepartmentsBySpace] = useState({});
  const [boardsByDepartment, setBoardsByDepartment] = useState({});
  const [activeSpaceId, setActiveSpaceId] = useState(() => readStorage(ACTIVE_SPACE_STORAGE_KEY) || "");
  const [activeBoardId, setActiveBoardId] = useState(() => readStorage(ACTIVE_BOARD_STORAGE_KEY) || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSpaces = useCallback(async () => {
    const list = await getSpaces();
    setSpaces(list);

    if (!list.length) {
      setActiveSpaceId("");
      return [];
    }

    const storedSpaceId = readStorage(ACTIVE_SPACE_STORAGE_KEY);
    const nextSpaceId =
      list.find((space) => space.id === activeSpaceId)?.id ||
      list.find((space) => space.id === storedSpaceId)?.id ||
      list[0]?.id ||
      "";

    setActiveSpaceId(nextSpaceId);
    return list;
  }, [activeSpaceId]);

  const ensureSpaceData = useCallback(async (spaceId) => {
    if (!spaceId || departmentsBySpace[spaceId]) {
      const cachedDepartments = departmentsBySpace[spaceId] || [];
      return {
        departments: cachedDepartments,
        boardsByDepartment: Object.fromEntries(
          cachedDepartments.map((department) => [
            department.id,
            boardsByDepartment[department.id] || [],
          ]),
        ),
      };
    }

    const departments = await getSpaceDepartments(spaceId);
    setDepartmentsBySpace((current) => ({
      ...current,
      [spaceId]: departments,
    }));

    const boardEntries = await Promise.all(
      departments.map(async (department) => {
        const boards = await getDepartmentBoards(department.id).catch(() => []);
        return [department.id, boards];
      }),
    );

    const nextBoardsByDepartment = Object.fromEntries(boardEntries);

    setBoardsByDepartment((current) => ({
      ...current,
      ...nextBoardsByDepartment,
    }));

    return {
      departments,
      boardsByDepartment: nextBoardsByDepartment,
    };
  }, [boardsByDepartment, departmentsBySpace]);

  const refreshApp = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const profile = await authService.getProfile();
      setUser(profile);
      const list = await fetchSpaces();

      const nextSpaceId =
        list.find((space) => space.id === activeSpaceId)?.id ||
        list[0]?.id ||
        "";

      if (nextSpaceId) {
        const spaceData = await ensureSpaceData(nextSpaceId);
        const boards = flattenBoards(spaceData.boardsByDepartment);

        const storedBoardId = readStorage(ACTIVE_BOARD_STORAGE_KEY);
        const nextBoardId =
          boards.find((board) => board.id === activeBoardId)?.id ||
          boards.find((board) => board.id === storedBoardId)?.id ||
          boards[0]?.id ||
          "";

        setActiveBoardId(nextBoardId);
        if (nextSpaceId) {
          const members = await getSpaceMembers(nextSpaceId).catch(() => []);
          setSpaceMembers(Array.isArray(members) ? members : []);
        }
      } else {
        setActiveBoardId("");
      }
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, [activeBoardId, activeSpaceId, boardsByDepartment, ensureSpaceData, fetchSpaces]);

  useEffect(() => {
    refreshApp();
  }, []);

  useEffect(() => {
    writeStorage(ACTIVE_SPACE_STORAGE_KEY, activeSpaceId);
  }, [activeSpaceId]);

  useEffect(() => {
    writeStorage(ACTIVE_BOARD_STORAGE_KEY, activeBoardId);
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeSpaceId) {
      return;
    }

    ensureSpaceData(activeSpaceId).catch(() => {});
  }, [activeSpaceId, ensureSpaceData]);

  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) || null,
    [spaces, activeSpaceId],
  );

  const activeDepartments = useMemo(
    () => departmentsBySpace[activeSpaceId] || [],
    [departmentsBySpace, activeSpaceId],
  );

  const activeBoards = useMemo(
    () => activeDepartments.flatMap((department) => boardsByDepartment[department.id] || []),
    [activeDepartments, boardsByDepartment],
  );

  const activeBoard = useMemo(
    () => activeBoards.find((board) => board.id === activeBoardId) || null,
    [activeBoards, activeBoardId],
  );

  const setActiveSpace = useCallback(async (spaceId) => {
    setActiveSpaceId(spaceId);
    setActiveBoardId("");
    setSpaceMembers([]);

    if (!spaceId) {
      return;
    }

    await setActiveSpaceSession(spaceId).catch(() => null);

    const spaceData = await ensureSpaceData(spaceId).catch(() => ({
      departments: [],
      boardsByDepartment: {},
    }));
    const boards = flattenBoards(spaceData.boardsByDepartment);
    setActiveBoardId(boards[0]?.id || "");

    const members = await getSpaceMembers(spaceId).catch(() => []);
    setSpaceMembers(Array.isArray(members) ? members : []);
  }, [ensureSpaceData]);

  const setActiveBoard = useCallback(async (boardId) => {
    setActiveBoardId(boardId);

    if (!boardId) {
      return;
    }

    const boardExists = activeBoards.some((board) => board.id === boardId);

    if (!boardExists) {
      const board = await getBoard(boardId).catch(() => null);

      if (!board) {
        return;
      }

      setBoardsByDepartment((current) => {
        const departmentBoards = current[board.departmentId] || [];
        if (departmentBoards.some((item) => item.id === board.id)) {
          return current;
        }

        return {
          ...current,
          [board.departmentId]: [...departmentBoards, board],
        };
      });

      if (board.spaceId) {
        setActiveSpaceId(board.spaceId);
      }
    }
  }, [activeBoards]);

  const value = useMemo(() => ({
    user,
    spaces,
    spaceMembers,
    activeSpace,
    activeSpaceId,
    activeDepartments,
    activeBoards,
    activeBoard,
    activeBoardId,
    loading,
    error,
    fetchSpaces: refreshApp,
    refreshApp,
    setActiveSpace,
    setActiveBoard,
  }), [
    user,
    spaces,
    spaceMembers,
    activeSpace,
    activeSpaceId,
    activeDepartments,
    activeBoards,
    activeBoard,
    activeBoardId,
    loading,
    error,
    refreshApp,
    setActiveSpace,
    setActiveBoard,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider.");
  }

  return context;
}
