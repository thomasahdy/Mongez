import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import boardsService from "../services/api/boardsService";
import membersService from "../services/api/membersService";
import spacesService from "../services/api/spacesService";
import { useSocket } from "../context/SocketContext";
import {
  readActiveSpaceId,
  writeActiveSpaceId,
} from "../utils/appStorageKeys";

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
  const user = useSelector((state) => state.users?.user || null);
  const { getSpacePresence } = useSocket();
  const [spaces, setSpaces] = useState([]);
  const [spaceMembers, setSpaceMembers] = useState([]);
  const [departmentsBySpace, setDepartmentsBySpace] = useState({});
  const [boardsByDepartment, setBoardsByDepartment] = useState({});
  const [activeSpaceId, setActiveSpaceId] = useState(() => readActiveSpaceId());
  const [activeBoardId, setActiveBoardId] = useState(() => readStorage(ACTIVE_BOARD_STORAGE_KEY) || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSpaces = useCallback(async () => {
    const response = await spacesService.getSpaces();
    const list = response?.spaces || [];
    setSpaces(list);

    if (!list.length) {
      setActiveSpaceId("");
      return [];
    }

    const storedSpaceId = readActiveSpaceId();
    const nextSpaceId =
      list.find((space) => space.id === activeSpaceId)?.id ||
      list.find((space) => space.id === storedSpaceId)?.id ||
      list[0]?.id ||
      "";

    setActiveSpaceId(nextSpaceId);
    return list;
  }, [activeSpaceId]);

  const ensureSpaceData = useCallback(
    async (spaceId) => {
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

      const departments = await spacesService.getSpaceDepartments(spaceId);
      setDepartmentsBySpace((current) => ({
        ...current,
        [spaceId]: departments,
      }));

      const boardEntries = departments.map((department) => [
        department.id,
        department.boards || [],
      ]);

      const nextBoardsByDepartment = Object.fromEntries(boardEntries);

      setBoardsByDepartment((current) => ({
        ...current,
        ...nextBoardsByDepartment,
      }));

      return {
        departments,
        boardsByDepartment: nextBoardsByDepartment,
      };
    },
    [boardsByDepartment, departmentsBySpace],
  );

  const refreshApp = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const list = await fetchSpaces();
      const nextSpaceId =
        list.find((space) => space.id === activeSpaceId)?.id ||
        list[0]?.id ||
        "";

      if (!nextSpaceId) {
        setActiveBoardId("");
        setSpaceMembers([]);
        return;
      }

      const spaceData = await ensureSpaceData(nextSpaceId);
      const boards = flattenBoards(spaceData.boardsByDepartment);
      const storedBoardId = readStorage(ACTIVE_BOARD_STORAGE_KEY);
      const nextBoardId =
        boards.find((board) => board.id === activeBoardId)?.id ||
        boards.find((board) => board.id === storedBoardId)?.id ||
        boards[0]?.id ||
        "";

      setActiveBoardId(nextBoardId);
      const members = await membersService.getMembers(nextSpaceId).catch(() => []);
      setSpaceMembers(Array.isArray(members) ? members : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load workspace data.");
    } finally {
      setLoading(false);
    }
  }, [activeBoardId, activeSpaceId, ensureSpaceData, fetchSpaces]);

  useEffect(() => {
    void refreshApp();
  }, [refreshApp]);

  useEffect(() => {
    writeActiveSpaceId(activeSpaceId);
  }, [activeSpaceId]);

  useEffect(() => {
    writeStorage(ACTIVE_BOARD_STORAGE_KEY, activeBoardId);
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeSpaceId) {
      setSpaceMembers([]);
      return;
    }

    ensureSpaceData(activeSpaceId).catch(() => {});
    membersService.getMembers(activeSpaceId).then(
      (members) => setSpaceMembers(Array.isArray(members) ? members : []),
      () => {},
    );
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

  const boardsByDepartmentList = useMemo(
    () =>
      activeDepartments.map((department) => ({
        ...department,
        boards: boardsByDepartment[department.id] || [],
      })),
    [activeDepartments, boardsByDepartment],
  );

  const activeBoard = useMemo(
    () => activeBoards.find((board) => board.id === activeBoardId) || null,
    [activeBoards, activeBoardId],
  );

  const setActiveSpace = useCallback(
    async (spaceId) => {
      setActiveSpaceId(spaceId);
      setActiveBoardId("");
      setSpaceMembers([]);

      if (!spaceId) {
        return;
      }

      await spacesService.setActiveSpace(spaceId).catch(() => null);

      const spaceData = await ensureSpaceData(spaceId).catch(() => ({
        departments: [],
        boardsByDepartment: {},
      }));
      const boards = flattenBoards(spaceData.boardsByDepartment);
      setActiveBoardId(boards[0]?.id || "");

      const members = await membersService.getMembers(spaceId).catch(() => []);
      setSpaceMembers(Array.isArray(members) ? members : []);
      getSpacePresence(spaceId);
    },
    [ensureSpaceData, getSpacePresence],
  );

  const setActiveBoard = useCallback(
    async (boardId) => {
      setActiveBoardId(boardId);

      if (!boardId) {
        return;
      }

      const boardExists = activeBoards.some((board) => board.id === boardId);

      if (boardExists) {
        return;
      }

      const board = await boardsService.getBoard(boardId).catch(() => null);
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
    },
    [activeBoards],
  );

  const value = useMemo(
    () => ({
      user,
      spaces,
      spaceMembers,
      activeSpace,
      activeSpaceId,
      activeDepartments,
      activeBoards,
      activeBoard,
      activeBoardId,
      boardsByDepartment: boardsByDepartmentList,
      loading,
      error,
      fetchSpaces: refreshApp,
      refreshApp,
      setActiveSpace,
      setActiveBoard,
    }),
    [
      user,
      spaces,
      spaceMembers,
      activeSpace,
      activeSpaceId,
      activeDepartments,
      activeBoards,
      activeBoard,
      activeBoardId,
      boardsByDepartmentList,
      loading,
      error,
      refreshApp,
      setActiveSpace,
      setActiveBoard,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider.");
  }

  return context;
}
