import React from 'react'
import { useNavigate } from 'react-router';
import MicroProgress from '../../components/ui/MicroProgress';
import Tag from '../../components/ui/Tag';
import AvatarGroup from '../../components/ui/AvatarGroup';
import MetaItem from '../../components/ui/MetaItem';
import BlockerBox from './BlockerBox';
import {CSS} from '@dnd-kit/utilities'
import {useSortable} from '@dnd-kit/sortable'

const TaskCard = ({ task }) => {
  const navigate = useNavigate();
  // 1. Fix: useSortable expects an object configuration
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
  
  const {
    progress, tags, title, avatars, extraAvatars = 0,
    dueLabel, dueVariant = "neutral", comments,
    blocker, leftBorder,
    done, doneLabel, celebration,
    views = [],
  } = task;

  const dueColors = {
    danger:  "text-red-500 font-semibold",
    warning: "text-amber-500 font-semibold",
    accent:  "text-indigo-500 font-medium",
    neutral: "text-slate-400",
  };

  // 2. Combine dnd-kit properties and your conditional left border into one single object
  const combinedStyle = {
    transition,
    transform: CSS.Transform.toString(transform),
    ...(leftBorder ? { borderLeftColor: leftBorder } : {})
  };

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={combinedStyle} // Pass the combined style object safely here
      className={`
        bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700
        transition-all duration-200 cursor-pointer hover:-translate-y-0.5
        hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1)] hover:border-slate-300 dark:hover:border-slate-600
        relative
        ${leftBorder ? `border-l-[3px]` : ""}
      `}
      role="listitem"
      tabIndex={0}
      onClick={() => navigate(`/tasks/${task.id}`)}
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
      {(avatars || dueLabel || comments !== undefined || views?.length > 0) && !done && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5">
          <div className="flex items-center gap-2">
            {avatars && <AvatarGroup avatars={avatars} extra={extraAvatars} />}
            {views?.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400/80 cursor-help" title={`Seen by: ${views.map(v => v.user?.name || 'User').join(', ')}`}>
                <i className="fa-regular fa-eye text-[10px]" />
                <span>{views.length}</span>
              </span>
            )}
          </div>
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

export default TaskCard;