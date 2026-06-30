import { useSocket } from "../../context/SocketContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const Avatar = ({ initials, color = "#6366f1", size = "sm", userId }) => {
  const dim = size === "sm" ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]";
  const { onlineUsers } = useSocket();
  const { isRTL } = useLocaleDirection();
  const isOnline = userId ? onlineUsers[userId] === 'ONLINE' : false;

  return (
    <span className="relative inline-block shrink-0">
      <span
        className={`${dim} rounded-full flex items-center justify-center text-white font-semibold`}
        style={{ background: color }}
        aria-label={`Avatar for ${initials}`}
      >
        {initials}
      </span>
      {userId && (
        <span
          className={`absolute bottom-0 block h-1.5 w-1.5 rounded-full ring-1 ring-white ${isRTL ? "left-0" : "right-0"} ${
            isOnline ? "bg-green-500" : "bg-slate-400"
          }`}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </span>
  );
}

export default Avatar
