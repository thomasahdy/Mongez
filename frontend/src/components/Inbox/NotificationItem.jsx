import React from 'react'
import NotifIconBadge from './NotifIconBadge';
import NotifActionButton from './NotifActionButton';

const NotificationItem = ({ notif, selected, onSelect, onAction, onClick }) => {
  return (
    <article
      className={`group flex gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 cursor-pointer
        ${notif.unread
          ? "border-l-[3px] border-l-sky-500 border-slate-200 dark:border-slate-700 bg-sky-50/60 dark:bg-sky-900/10"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
        }
        hover:shadow-sm`}
      role="listitem"
      aria-label={notif.title}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      tabIndex={0}
    >
      {/* Checkbox */}
      <div className="flex items-start pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-sky-500 cursor-pointer"
          aria-label={`Select notification: ${notif.title}`}
        />
      </div>

      {/* Icon */}
      <NotifIconBadge bg={notif.iconBg} color={notif.iconColor} icon={notif.icon} />

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Title row */}
        <div className="flex items-center gap-1.5 mb-0.5">
          {notif.unread && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"
              aria-label="Unread"
            />
          )}
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">
            {notif.title}
          </p>
        </div>

        {/* Description */}
        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-1.5">
          {notif.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
          <time>{notif.time}</time>
          <span
            className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
          >
            {notif.project}
          </span>
        </div>
      </div>

      {/* Actions — visible on group hover or focus-within */}
      <div
        className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150"
        aria-label="Notification actions"
        role="group"
      >
        {notif.actions.map((action) => (
          <NotifActionButton
            key={action.id}
            icon={action.icon}
            title={action.title}
            onClick={() => onAction(notif.id, action.id)}
          />
        ))}
      </div>
    </article>
  );
}

export default NotificationItem
