import React from "react";
import { useNavigate } from "react-router";
import MicroProgress from "../../components/ui/MicroProgress";
import Tag from "../../components/ui/Tag";
import AvatarGroup from "../../components/ui/AvatarGroup";
import MetaItem from "../../components/ui/MetaItem";
import BlockerBox from "./BlockerBox";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";

const TaskCard = ({ task }) => {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });

  const {
    id,
    title,
    description,
    status,
    priority,
    tags,
    assignee,
    progress,
    percentDone,
    commentsCount,
    _count,
    dueDate,
    views,
    blocker,
  } = task;

  // normalize inside component (no external mapper needed)
  const normalizedTags = (tags || []).map((t) =>
    typeof t === "string"
      ? { label: t, variant: "default" }
      : t
  );

  const avatars = assignee
    ? [{ id: assignee.id, name: assignee.name }]
    : [];

  const commentCount = _count?.comments ?? commentsCount ?? 0;

  const isDone = status === "DONE";

  const progressValue = percentDone ?? progress ?? 0;

  const dueLabel = dueDate
    ? new Date(dueDate).toLocaleDateString()
    : null;

  const dueColors = {
    danger: "text-red-500 font-semibold",
    warning: "text-amber-500 font-semibold",
    accent: "text-indigo-500 font-medium",
    neutral: "text-slate-400",
  };

  const priorityColor =
    priority === "HIGH"
      ? "#ef4444"
      : priority === "MEDIUM"
      ? "#f59e0b"
      : "#22c55e";

  const combinedStyle = {
    transition,
    transform: CSS.Transform.toString(transform),
    borderLeftColor: priorityColor,
  };

  return (
    <article
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={combinedStyle}
      className={`
        bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700
        transition-all duration-200 cursor-pointer hover:-translate-y-0.5
        hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1)]
        relative border-l-[3px]
      `}
      role="listitem"
      tabIndex={0}
      onClick={() => navigate(`/tasks/${id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/tasks/${id}`)}
    >
      {/* Progress */}
      {progressValue !== undefined && (
        <MicroProgress value={progressValue} />
      )}

      {/* Tags */}
      {normalizedTags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {normalizedTags.map((t, i) => (
            <Tag key={i} variant={t.variant}>
              {t.label}
            </Tag>
          ))}
        </div>
      )}

      {/* Title */}
      <h3
        className={`text-[13px] font-semibold leading-snug mb-2.5 ${
          isDone
            ? "line-through text-slate-400"
            : "text-slate-800 dark:text-slate-100"
        }`}
      >
        {title}
      </h3>

      {/* Description (optional but useful) */}
      {description && (
        <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">
          {description}
        </p>
      )}

      {/* Blocker */}
      {blocker && <BlockerBox {...blocker} />}

      {/* Meta */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5">
        <div className="flex items-center gap-2">
          <AvatarGroup avatars={avatars} extra={0} />

          <span
            className="flex items-center gap-1"
            title="Views"
          >
            <i className="fa-regular fa-eye text-[10px]" />
            {views?.length ?? 0}
          </span>
        </div>

        {dueLabel && (
          <span className={`flex items-center gap-1 ${dueColors.neutral}`}>
            <i className="fa-regular fa-clock" />
            {dueLabel}
          </span>
        )}

        <MetaItem icon="fa-regular fa-comment" count={commentCount} />
      </div>
    </article>
  );
};

export default TaskCard;