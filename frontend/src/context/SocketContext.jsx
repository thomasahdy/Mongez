import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "../services/api/tokenService";
import { showToastBridge } from "./ToastContext";
import i18n from "../i18n";

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  joinBoard: () => {},
  leaveBoard: () => {},
  joinTask: () => {},
  leaveTask: () => {},
  onlineUsers: {},
  getSpacePresence: () => {},
  typingUsers: {},
  sendTypingStatus: () => {},
});

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;

    // Connect to /ws namespace on the backend
    const socketInstance = io(`${socketUrl}/ws`, {
      auth: { token },
      transports: ["websocket"],
      autoConnect: true,
      reconnection: true,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
      console.log("Socket.io connected successfully to /ws");
    });

    // Request permission for HTML5 native browser notifications
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          console.log("Browser notification permission state:", permission);
        });
      }
    }


    socketInstance.on("disconnect", () => {
      setIsConnected(false);
      console.log("Socket.io disconnected");
    });

    // Heartbeat interval to keep user presence alive in Redis
    // Backend expects heartbeat events every 30 seconds (Redis TTL is 90-180s)
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit("heartbeat");
      }
    }, 30000); // 30 seconds

    // Real-time Event Listeners for Query Cache Invalidation
    
    // Tasks
    socketInstance.on("task:created", (task) => {
      console.log("Realtime Task Created:", task);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["SpaceAnalytics"] });
    });

    socketInstance.on("task:updated", (data) => {
      console.log("Realtime Task Updated:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", data.id] });
      queryClient.invalidateQueries({ queryKey: ["task", data.id] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["SpaceAnalytics"] });
    });

    socketInstance.on("task:moved", (data) => {
      console.log("Realtime Task Moved:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["SpaceAnalytics"] });
    });

    socketInstance.on("task:archived", (data) => {
      console.log("Realtime Task Archived:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["SpaceAnalytics"] });
    });

    socketInstance.on("task:seen", (data) => {
      console.log("Realtime Task Seen:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", data.taskId] });
      queryClient.invalidateQueries({ queryKey: ["task", data.taskId] });
    });

    // Comments
    socketInstance.on("comment:added", (comment) => {
      console.log("Realtime Comment Added:", comment);
      queryClient.invalidateQueries({ queryKey: ["comments", comment.taskId] });
      queryClient.invalidateQueries({ queryKey: ["task", comment.taskId] });
    });

    // Notifications
    socketInstance.on("notification:new", (notif) => {
      console.log("Realtime Notification:", notif);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", notif.spaceId || ""] });
      showToastBridge(
        {
          key: "toasts.notificationReceived",
          values: {
            title: notif.title || i18n.t("toasts.notificationFallbackTitle"),
            body: notif.body || i18n.t("toasts.notificationFallbackBody"),
          },
        },
        "info",
      );

      // Show native OS notification if permission is granted
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const nativeNotif = new Notification(notif.title, {
            body: notif.body,
            icon: window.location.origin + "/src/assets/MongezMLogo.svg",
            badge: window.location.origin + "/src/assets/MongezMLogo.svg",
            tag: notif.id,
            requireInteraction: true,
          });


          nativeNotif.onclick = (e) => {
            e.preventDefault();
            window.focus();
            
            // Navigate directly to the task page if task related
            const entityType = (notif.entityType || '').toLowerCase();
            const type = notif.type || '';
            const entityId = notif.entityId;

            if (
              entityType === 'task' ||
              type === 'TASK_ASSIGNED' ||
              type === 'TASK_DUE' ||
              type === 'TASK_UPDATED' ||
              type === 'COMMENT_MENTION' ||
              type === 'FILE_UPLOADED'
            ) {
              if (entityId) {
                window.location.href = `/tasks/${entityId}`;
                return;
              }
            }

            // Fallback: go to inbox
            window.location.href = '/inbox';
          };
        } catch (err) {
          console.error("Failed to show native browser notification:", err);
        }
      }
    });


    socketInstance.on("notification:count", (data) => {
      console.log("Realtime Notification Count:", data);
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", data.spaceId || ""] });
    });

    socketInstance.on("export:ready", (data) => {
      console.log("Realtime Export Ready:", data);
      showToastBridge(data.message, "success");
      if (data.url && typeof window !== "undefined") {
        window.open(data.url, "_blank");
      }
    });

    socketInstance.on("notification:read", (data) => {
      console.log("Realtime Notification Read:", data);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    });

    socketInstance.on("notification:deleted", (data) => {
      console.log("Realtime Notification Deleted:", data);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    });

    // User presence listeners
    socketInstance.on("presence:status", ({ userId, status }) => {
      console.log(`Presence Status Changed for ${userId}: ${status}`);
      setOnlineUsers((prev) => ({
        ...prev,
        [userId]: status,
      }));
    });

    socketInstance.on("space:presence-list", (statusMap) => {
      console.log("Received initial space presence list:", statusMap);
      setOnlineUsers((prev) => ({
        ...prev,
        ...statusMap,
      }));
    });

    socketInstance.on("task:typing-status", (data) => {
      console.log("Realtime Task Typing Status:", data);
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) {
          next[data.taskId] = next[data.taskId] || [];
          if (!next[data.taskId].some((u) => u.userId === data.userId)) {
            next[data.taskId].push({ userId: data.userId, name: data.name || "Someone" });
          }
          // Auto-expire typing indicator after 5s of no update
          setTimeout(() => {
            setTypingUsers((current) => {
              if (!current[data.taskId]) return current;
              const nextCurrent = { ...current };
              nextCurrent[data.taskId] = nextCurrent[data.taskId].filter((u) => u.userId !== data.userId);
              if (nextCurrent[data.taskId].length === 0) {
                delete nextCurrent[data.taskId];
              }
              return nextCurrent;
            });
          }, 5000);
        } else {
          if (next[data.taskId]) {
            next[data.taskId] = next[data.taskId].filter((u) => u.userId !== data.userId);
            if (next[data.taskId].length === 0) {
              delete next[data.taskId];
            }
          }
        }
        return next;
      });
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    return () => {
      clearInterval(heartbeatInterval);
      socketInstance.disconnect();
      if (socketRef.current === socketInstance) {
        socketRef.current = null;
      }
    };
  }, [queryClient]);

  const joinBoard = (boardId) => {
    if (socket) socket.emit("join:board", boardId);
  };

  const leaveBoard = (boardId) => {
    if (socket) socket.emit("leave:board", boardId);
  };

  const joinTask = (taskId) => {
    if (socket) socket.emit("join:task", taskId);
  };

  const leaveTask = (taskId) => {
    if (socket) socket.emit("leave:task", taskId);
  };

  const getSpacePresence = (spaceId) => {
    if (socket) socket.emit("space:get-presence", spaceId);
  };

  const sendTypingStatus = (taskId, isTyping) => {
    if (socket) {
      socket.emit("task:typing", { taskId, isTyping });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinBoard,
        leaveBoard,
        joinTask,
        leaveTask,
        onlineUsers,
        getSpacePresence,
        typingUsers,
        sendTypingStatus,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
