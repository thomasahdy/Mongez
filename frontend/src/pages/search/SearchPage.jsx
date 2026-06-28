import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import NoResults from "./NoResults";
import ResultFilterTabs from "./sections/ResultFilterTabs";
import SearchHero from "./sections/SearchHero";
import ResultItem from "../../components/search/ResultItem";
import { useAppContext } from "../AppContext";
import { useGlobalSearch } from "../../hooks/api/useSearch";
import { useSpaceMembersQuery } from "../../hooks/useSettingsQueries";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";

  const [query, setQuery] = useState(qParam);
  const [activeQuery, setActiveQuery] = useState(qParam);
  const [activeFilter, setActiveFilter] = useState("all");

  const { activeSpaceId } = useAppContext();

  // Fetch search results from NestJS backend
  const { data: rawSearchResults, isLoading: searchLoading } = useGlobalSearch(
    activeQuery,
    activeSpaceId
  );

  // Fetch space members to filter locally for the "people" tab
  const { data: spaceMembers, isLoading: membersLoading } = useSpaceMembersQuery(activeSpaceId);

  useEffect(() => {
    setQuery(qParam);
    setActiveQuery(qParam);
  }, [qParam]);

  const hasResults = Boolean(activeQuery.trim());

  // Map backend results to the expected ResultItem flat structure
  const mappedResults = useMemo(() => {
    if (!activeQuery.trim() || (!rawSearchResults && !spaceMembers)) return [];

    const list = [];
    const term = activeQuery.toLowerCase().trim();

    // 1. Map Tasks
    if (rawSearchResults && Array.isArray(rawSearchResults.tasks)) {
      rawSearchResults.tasks.forEach((task) => {
        let iconBg = "bg-sky-100 dark:bg-sky-900/30";
        let iconColor = "text-sky-500";
        let icon = "fa-clipboard-list";

        const status = (task.status || "").toUpperCase();
        if (status.includes("DONE")) {
          iconBg = "bg-emerald-100 dark:bg-emerald-900/30";
          iconColor = "text-emerald-500";
          icon = "fa-circle-check";
        } else if (status.includes("PROGRESS")) {
          iconBg = "bg-sky-100 dark:bg-sky-900/30";
          iconColor = "text-sky-500";
          icon = "fa-spinner fa-spin"; // Subtle spin animation for tasks in progress
        } else if (status.includes("WAIT")) {
          iconBg = "bg-amber-100 dark:bg-amber-900/30";
          iconColor = "text-amber-500";
          icon = "fa-pause";
        }

        list.push({
          id: task.id,
          type: "tasks",
          iconBg,
          iconColor,
          icon,
          title: task.title,
          description: task.description || `Task ID: ${task.identifier}`,
          tags: [task.status, task.priority, ...(task.tags || [])].filter(Boolean),
          targetUrl: `/tasks/${task.id}`,
        });
      });
    }

    // 2. Map Approvals
    if (rawSearchResults && Array.isArray(rawSearchResults.approvals)) {
      rawSearchResults.approvals.forEach((approval) => {
        list.push({
          id: approval.id,
          type: "tasks", // Show approvals under Tasks tab
          iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
          iconColor: "text-indigo-500",
          icon: "fa-file-signature",
          title: approval.definition?.name || "Approval Request",
          description: `Requested by ${approval.requester?.name || "Unknown"} · Status: ${approval.status}`,
          tags: ["Approval", approval.status, approval.entityType].filter(Boolean),
          targetUrl: approval.entityType === "task" && approval.entityId ? `/tasks/${approval.entityId}` : null,
        });
      });
    }

    // 3. Map Files
    if (rawSearchResults && Array.isArray(rawSearchResults.files)) {
      rawSearchResults.files.forEach((file) => {
        let icon = "fa-file-lines";
        const mime = (file.mimeType || "").toLowerCase();
        if (mime.includes("pdf")) icon = "fa-file-pdf";
        else if (mime.includes("excel") || mime.includes("spreadsheet") || mime.includes("xls")) icon = "fa-file-excel";
        else if (mime.includes("image")) icon = "fa-file-image";
        else if (mime.includes("word") || mime.includes("doc")) icon = "fa-file-word";

        list.push({
          id: file.id,
          type: "files",
          iconBg: "bg-sky-100 dark:bg-sky-900/30",
          iconColor: "text-sky-700",
          icon,
          title: file.fileName,
          description: file.task?.title ? `Uploaded in: ${file.task.title}` : "Workspace Attachment",
          tags: [file.mimeType, file.createdAt ? new Date(file.createdAt).toLocaleDateString() : null].filter(Boolean),
          targetUrl: file.task?.id ? `/tasks/${file.task.id}` : null,
        });
      });
    }

    // 4. Map Comments
    if (rawSearchResults && Array.isArray(rawSearchResults.comments)) {
      rawSearchResults.comments.forEach((comment) => {
        list.push({
          id: comment.id,
          type: "comments",
          iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
          iconColor: "text-yellow-700",
          icon: "fa-regular fa-comment",
          title: `Comment by ${comment.author?.name || "User"}`,
          description: comment.content,
          tags: ["Comment", comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : null].filter(Boolean),
          targetUrl: comment.task?.id ? `/tasks/${comment.task.id}` : null,
        });
      });
    }

    // 5. Map Space Members (filter locally)
    if (Array.isArray(spaceMembers)) {
      spaceMembers.forEach((member) => {
        const user = member.user || {};
        const userName = user.name || "";
        const userEmail = user.email || "";

        if (userName.toLowerCase().includes(term) || userEmail.toLowerCase().includes(term)) {
          list.push({
            id: member.id || user.id,
            type: "people",
            iconBg: "bg-slate-100 dark:bg-slate-700",
            iconColor: "text-slate-500",
            icon: "fa-user",
            title: userName,
            description: `${member.role || "Member"} · ${userEmail}`,
            tags: ["Team Member", member.role].filter(Boolean),
            targetUrl: "/settings/members",
          });
        }
      });
    }

    return list;
  }, [rawSearchResults, spaceMembers, activeQuery]);

  const filteredResults = useMemo(() => {
    if (activeFilter === "all") return mappedResults;
    return mappedResults.filter((r) => r.type === activeFilter);
  }, [mappedResults, activeFilter]);

  const tabCounts = useMemo(() => {
    return {
      all: mappedResults.length,
      tasks: mappedResults.filter((r) => r.type === "tasks").length,
      files: mappedResults.filter((r) => r.type === "files").length,
      people: mappedResults.filter((r) => r.type === "people").length,
      comments: mappedResults.filter((r) => r.type === "comments").length,
    };
  }, [mappedResults]);

  const tabs = useMemo(() => [
    { id: "all",      label: "All",      count: tabCounts.all },
    { id: "tasks",    label: "Tasks",    count: tabCounts.tasks },
    { id: "files",    label: "Files",    count: tabCounts.files },
    { id: "people",   label: "People",   count: tabCounts.people },
    { id: "comments", label: "Comments", count: tabCounts.comments },
  ], [tabCounts]);

  const handleSearch = useCallback((q) => {
    if (!q.trim()) return;
    setSearchParams({ q });
  }, [setSearchParams]);

  const handleQueryChange = useCallback((val) => {
    setQuery(val);
    if (!val.trim()) {
      setSearchParams({});
    }
  }, [setSearchParams]);

  const isLoading = searchLoading || membersLoading;

  return (
    <>
      {/* Scrollable content area */}
      <main
        className="flex-1 overflow-y-auto"
        aria-label={hasResults ? `Search results for "${activeQuery}"` : "Search"}
      >
        {!hasResults ? (
          /* ── EMPTY STATE ── */
          <SearchHero
            query={query}
            onQueryChange={handleQueryChange}
            onSearch={handleSearch}
          />
        ) : (
          /* ── RESULTS STATE ── */
          <div className="px-6 py-6 max-w-[820px] mx-auto">
            {/* Filter tabs */}
            <ResultFilterTabs
              tabs={tabs}
              activeId={activeFilter}
              onChange={setActiveFilter}
            />

            {/* Results, Loading Skeletons, or Empty */}
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="flex gap-3 px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl animate-pulse"
                  >
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredResults.length === 0 ? (
              <NoResults query={activeQuery} />
            ) : (
              <div
                className="flex flex-col gap-2"
                role="list"
                aria-label={`${filteredResults.length} search results`}
              >
                {filteredResults.map((result) => (
                  <ResultItem key={result.id} result={result} query={activeQuery} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
