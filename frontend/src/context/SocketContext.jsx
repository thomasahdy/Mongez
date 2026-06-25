import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "../services/api/tokenService";

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  joinBoard: () => {},
  leaveBoard: () => {},
  joinTask: () => {},
  leaveTask: () => {},
  onlineUsers: {},
  getSpacePresence: () => {},
});

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      if (socket) {
        socket.disconnect();
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
    });

    socketInstance.on("task:updated", (data) => {
      console.log("Realtime Task Updated:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", data.id] });
      queryClient.invalidateQueries({ queryKey: ["task", data.id] });
    });

    socketInstance.on("task:moved", (data) => {
      console.log("Realtime Task Moved:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    });

    socketInstance.on("task:archived", (data) => {
      console.log("Realtime Task Archived:", data);
      queryClient.invalidateQueries({ queryKey: ["boards"] });
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
      queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
    });

    socketInstance.on("notification:count", (data) => {
      console.log("Realtime Notification Count:", data);
      queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
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

    setSocket(socketInstance);

    return () => {
      clearInterval(heartbeatInterval);
      socketInstance.disconnect();
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

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinBoard, leaveBoard, joinTask, leaveTask, onlineUsers, getSpacePresence }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
