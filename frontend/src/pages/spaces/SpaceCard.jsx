import { useState } from "react";
import { useTranslation } from "react-i18next";
import SpaceCardHeader from "./SpaceCardHeader";
import DepartmentRow from "./DepartmentRow";
import { useCreateDepartment, useSpaceDepartments } from "../../hooks/api/useSpaces";
import CreateDepartmentCard from "./CreateDepartmentCard";
import { useToast } from "../../context/ToastContext";
import CreateDepartmentModal from "./CreateDepartmentModal";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";

const SpaceCard = ({ space, onEdit, onDelete, onInvite }) => {
  const { t } = useTranslation();
  const { isRTL } = useLocaleDirection();
  const [expanded, setExpanded] = useState(true);
  const [showCreateDepModal, setShowCreateDepModal] = useState(false);
  const createDepartment = useCreateDepartment();
  const toast = useToast();
  const { data: departments, isLoading, error } = useSpaceDepartments(space.id);

  const rawDepartmentsList = Array.isArray(departments) ? departments : departments?.departments || [];
  const normalizedDepartments = rawDepartmentsList.map((department) => ({
    ...department,
    color: department.color || "#6366f1",
    initials:
      department.initials ||
      (department.name ? department.name.split(" ").map((item) => item[0]).join("").toUpperCase().slice(0, 2) : "D"),
    isAdmin: department.isAdmin !== undefined ? department.isAdmin : department.role === "ADMIN",
    stats: {
      boards: department.stats?.boards ?? department._count?.boards ?? 0,
      members: department.stats?.members ?? department._count?.memberships ?? department._count?.members ?? department.memberCount ?? 0,
      tasks: department.stats?.tasks ?? department._count?.tasks ?? 0,
    },
    boards: department.boards || [],
    members: department.members || [],
  }));

  const handleCreateDepartment = async (data) => {
    try {
      await createDepartment.mutateAsync({ spaceId: space.id, data });
      setShowCreateDepModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || t("spacesPage.createDepartmentFailed"));
    }
  };

  return (
    <article
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-fadeIn dark:border-slate-700 dark:bg-slate-800"
      aria-label={t("spacesPage.spaceAria", { name: space.name })}
    >
      <SpaceCardHeader
        space={space}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
        onInvite={() => onInvite(space.id)}
        onSettings={() => onEdit(space)}
        onMore={() => onDelete(space.id)}
      />

      <div className={`overflow-hidden transition-all duration-300 ${expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`} aria-hidden={!expanded}>
        <div className="px-6 pb-5 pt-1">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center font-medium text-slate-500 animate-pulse">
              <svg className="h-6 w-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{t("spacesPage.loadingDepartments")}</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center font-medium text-red-500">
              {t("spacesPage.departmentsError", { message: error.message || t("common.unknown") })}
            </div>
          ) : normalizedDepartments.length > 0 ? (
            normalizedDepartments.map((department) => (
              <DepartmentRow key={department.id} dept={department} />
            ))
          ) : (
            <p className={`py-3 text-xs text-slate-400 dark:text-slate-500 ${isRTL ? "pr-2" : "pl-2"}`}>
              {t("spacesPage.noDepartments")}
            </p>
          )}

          <CreateDepartmentCard onClick={() => setShowCreateDepModal(true)} />
        </div>
      </div>

      {showCreateDepModal ? (
        <CreateDepartmentModal space={space} onSubmit={handleCreateDepartment} onClose={() => setShowCreateDepModal(false)} />
      ) : null}
    </article>
  );
};

export default SpaceCard;
