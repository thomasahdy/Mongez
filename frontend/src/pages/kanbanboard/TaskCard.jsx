import React from 'react'
import MicroProgress from '../../components/ui/MicroProgress';
import Tag from '../../components/ui/Tag';
import AvatarGroup from '../../components/ui/AvatarGroup';
import MetaItem from '../../components/ui/MetaItem';
import BlockerBox from './BlockerBox';

const TaskCard = ({ card }) => {
  const {
    progress, tags, title, avatars, extraAvatars = 0,
    dueLabel, dueVariant = "neutral", comments,
    blocker, leftBorder,
    done, doneLabel, celebration,
  } = card;

  const dueColors = {
    danger:  "text-red-500 font-semibold",
    warning: "text-amber-500 font-semibold",
    accent:  "text-indigo-500 font-medium",
    neutral: "text-slate-400",
  };

  return (
    <article
      className={`
        bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700
        transition-all duration-200 cursor-pointer hover:-translate-y-0.5
        hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1)] hover:border-slate-300 dark:hover:border-slate-600
        relative
        ${leftBorder ? `border-l-[3px]` : ""}
      `}
      style={leftBorder ? { borderLeftColor: leftBorder } : undefined}
      role="listitem"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()}
      aria-label={`Task: ${title}`}
    >
      {progress !== undefined && <MicroProgress value={progress} />}

      {/* Tags */}
      {tags?.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {tags.map((t, i) => <Tag key={i} variant={t.variant}>{t.label}</Tag>)}
        </div>
      )}

      {/* Title */}
      <h3 className={`text-[13px] font-semibold leading-snug mb-2.5 ${done ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>
        {title}
      </h3>

      {/* Blocker */}
      {blocker && <BlockerBox {...blocker} />}

      {/* Done label */}
      {doneLabel && (
        <div className="flex items-center gap-1.5 text-emerald-500 text-[11px] font-semibold">
          <i className="fa-solid fa-check" /> {doneLabel}
        </div>
      )}

      {/* Celebration block */}
      {celebration && (
        <div className="mt-2 px-2.5 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] text-emerald-600 font-medium flex flex-col gap-1">
          {celebration.map((line, i) => (
            <span key={i} dangerouslySetInnerHTML={{ __html: line }} />
          ))}
        </div>
      )}

      {/* Meta row */}
      {(avatars || dueLabel || comments !== undefined) && !done && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5">
          {avatars && <AvatarGroup avatars={avatars} extra={extraAvatars} />}
          {dueLabel && (
            <span className={`flex items-center gap-1 ${dueColors[dueVariant]}`}>
              {dueVariant !== "neutral" && <i className="fa-regular fa-clock" />}
              {dueLabel}
            </span>
          )}
          {comments !== undefined && <MetaItem icon="fa-regular fa-comment" count={comments} />}
        </div>
      )}
    </article>
  );
}

export default TaskCard
