import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import NoResults from "./NoResults";
import ResultFilterTabs from "./sections/ResultFilterTabs";
import SearchHero from "./sections/SearchHero";
import ResultItem from "../../components/search/ResultItem";
import { useAppContext } from "../AppContext";
import { useGlobalSearch } from "../../hooks/api/useSearch";
import { useSpaceMembersQuery } from "../../hooks/useSettingsQueries";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

export default function SearchPage() {
  const { t } = useTranslation();
  const { locale } = useLocaleDirection();
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";

  const [query, setQuery] = useState(qParam);
  const [activeQuery, setActiveQuery] = useState(qParam);
  const [activeFilter, setActiveFilter] = useState("all");

  const { activeSpaceId } = useAppContext();
  const { data: rawSearchResults, isLoading: searchLoading } = useGlobalSearch(activeQuery, activeSpaceId);
  const { data: spaceMembers, isLoading: membersLoading } = useSpaceMembersQuery(activeSpaceId);

  useEffect(() => {
    setQuery(qParam);
    setActiveQuery(qParam);
  }, [qParam]);

  const hasResults = Boolean(activeQuery.trim());

  const mappedResults = useMemo(() => {
    if (!activeQuery.trim() || (!rawSearchResults && !spaceMembers)) {
      return [];
    }

    const list = [];
    const term = activeQuery.toLowerCase().trim();

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
          icon = "fa-spinner fa-spin";
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
          description: task.description || t("searchPage.labels.taskId", { value: task.identifier }),
          tags: [task.status, task.priority, ...(task.tags || [])].filter(Boolean),
          targetUrl: `/tasks/${task.id}`,
        });
      });
    }

    if (rawSearchResults && Array.isArray(rawSearchResults.approvals)) {
      rawSearchResults.approvals.forEach((approval) => {
        list.push({
          id: approval.id,
          type: "tasks",
          iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
          iconColor: "text-indigo-500",
          icon: "fa-file-signature",
          title: approval.definition?.name || t("searchPage.labels.approvalRequest"),
          description: `${t("searchPage.labels.requestedBy", {
            name: approval.requester?.name || t("common.unknown"),
          })} · ${t("searchPage.labels.status", { value: approval.status })}`,
          tags: [t("searchPage.labels.approval"), approval.status, approval.entityType].filter(Boolean),
          targetUrl: approval.entityType === "task" && approval.entityId ? `/tasks/${approval.entityId}` : null,
        });
      });
    }

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
          description: file.task?.title
            ? t("searchPage.labels.uploadedIn", { title: file.task.title })
            : t("searchPage.labels.workspaceAttachment"),
          tags: [file.mimeType, file.createdAt ? new Date(file.createdAt).toLocaleDateString(locale) : null].filter(Boolean),
          targetUrl: file.task?.id ? `/tasks/${file.task.id}` : null,
        });
      });
    }

    if (rawSearchResults && Array.isArray(rawSearchResults.comments)) {
      rawSearchResults.comments.forEach((comment) => {
        list.push({
          id: comment.id,
          type: "comments",
          iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
          iconColor: "text-yellow-700",
          icon: "fa-regular fa-comment",
          title: t("searchPage.labels.commentBy", { name: comment.author?.name || t("common.unknown") }),
          description: comment.content,
          tags: [t("searchPage.labels.comment"), comment.createdAt ? new Date(comment.createdAt).toLocaleDateString(locale) : null].filter(Boolean),
          targetUrl: comment.task?.id ? `/tasks/${comment.task.id}` : null,
        });
      });
    }

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
            description: `${member.role || t("searchPage.labels.member")} · ${userEmail}`,
            tags: [t("searchPage.labels.teamMember"), member.role].filter(Boolean),
            targetUrl: "/settings/members",
          });
        }
      });
    }

    return list;
  }, [activeQuery, locale, rawSearchResults, spaceMembers, t]);

  const filteredResults = useMemo(() => {
    if (activeFilter === "all") return mappedResults;
    return mappedResults.filter((result) => result.type === activeFilter);
  }, [mappedResults, activeFilter]);

  const tabCounts = useMemo(
    () => ({
      all: mappedResults.length,
      tasks: mappedResults.filter((result) => result.type === "tasks").length,
      files: mappedResults.filter((result) => result.type === "files").length,
      people: mappedResults.filter((result) => result.type === "people").length,
      comments: mappedResults.filter((result) => result.type === "comments").length,
    }),
    [mappedResults],
  );

  const tabs = useMemo(
    () => [
      { id: "all", label: t("searchPage.tabs.all"), count: tabCounts.all },
      { id: "tasks", label: t("searchPage.tabs.tasks"), count: tabCounts.tasks },
      { id: "files", label: t("searchPage.tabs.files"), count: tabCounts.files },
      { id: "people", label: t("searchPage.tabs.people"), count: tabCounts.people },
      { id: "comments", label: t("searchPage.tabs.comments"), count: tabCounts.comments },
    ],
    [tabCounts, t],
  );

  const handleSearch = useCallback(
    (nextQuery) => {
      if (!nextQuery.trim()) return;
      setSearchParams({ q: nextQuery });
    },
    [setSearchParams],
  );

  const handleQueryChange = useCallback(
    (value) => {
      setQuery(value);
      if (!value.trim()) {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

  const isLoading = searchLoading || membersLoading;

  return (
    <main
      className="flex-1 overflow-y-auto"
      aria-label={hasResults ? t("searchPage.resultsAria", { query: activeQuery }) : t("searchPage.emptyAria")}
    >
      {!hasResults ? (
        <SearchHero query={query} onQueryChange={handleQueryChange} onSearch={handleSearch} />
      ) : (
        <div className="mx-auto max-w-[820px] px-6 py-6">
          <ResultFilterTabs tabs={tabs} activeId={activeFilter} onChange={setActiveFilter} />

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 animate-pulse dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-1/4 rounded bg-slate-200 dark:bg-slate-700"></div>
                    <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredResults.length === 0 ? (
            <NoResults query={activeQuery} />
          ) : (
            <div className="flex flex-col gap-2" role="list" aria-label={t("searchPage.listAria", { count: filteredResults.length })}>
              {filteredResults.map((result) => (
                <ResultItem key={result.id} result={result} query={activeQuery} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
