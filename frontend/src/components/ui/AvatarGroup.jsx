import Avatar from "./Avatar";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const AvatarGroup = ({ avatars, extra = 0 }) => {
  const { isRTL } = useLocaleDirection();

  return (
    <div className="flex items-center">
      {avatars.map((av, i) => {
        const initials = av.initials || String(av.name || av.email || "U").slice(0, 2).toUpperCase();

        return (
          <span key={i} className={i > 0 ? `${isRTL ? "-mr-1.5" : "-ml-1.5"} border-2 border-white dark:border-slate-800 rounded-full` : ""}>
            <Avatar initials={initials} color={av.color} size="sm" userId={av.id || av.userId} src={av.avatarUrl || av.src} />
          </span>
        );
      })}
      {extra > 0 && (
        <span className={`${isRTL ? "mr-1" : "ml-1"} text-[11px] text-slate-400`}>+{extra}</span>
      )}
    </div>
  );
};

export default AvatarGroup;
