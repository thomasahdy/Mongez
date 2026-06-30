import { useNavigate } from "react-router";
import ResultIconBadge from './ResultIconBadge';
import HighlightedText from './../ui/HighlightedText'
import ResultTag from './ResultTag';

const ResultItem = ({ result, query }) => {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (result.targetUrl) {
      navigate(result.targetUrl);
    }
  };

  return (
    <article
      className="flex gap-3 px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      role="listitem"
      tabIndex={0}
      aria-label={result.title}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
    >
      <ResultIconBadge bg={result.iconBg} color={result.iconColor} icon={result.icon} />

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 mb-0.5 leading-snug">
          <HighlightedText text={result.title} query={query} />
        </p>
        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed mb-1.5 line-clamp-2">
          <HighlightedText text={result.description || ""} query={query} />
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.tags && result.tags.map((tag) => (
            <ResultTag key={tag} label={tag} />
          ))}
        </div>
      </div>
    </article>
  );
}

export default ResultItem
