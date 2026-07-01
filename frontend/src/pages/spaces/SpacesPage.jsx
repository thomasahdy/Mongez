import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import SpaceCard from "./SpaceCard";
import SpacesHeader from "./SpacesHeader";
import CreateSpaceCard from "./CreateSpaceCard";
import QuotaBanner from "./QuotaBanner";
import CreateSpaceModal from "./CreateSpaceModal";
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace } from "../../hooks/api/useSpaces";
import { useToast } from "../../context/ToastContext";
import { useLocaleDirection } from "../../hooks/useLocaleDirection";
import { getErrorMessage } from "../../utils/errorMessage";
import { readActiveSpaceId, removeActiveSpaceId, writeActiveSpaceId } from "../../utils/appStorageKeys";

const QUOTA = { total: 5 };

export default function SpacesPage({ setPath }) {
  const { t } = useTranslation();
  const { dir, isRTL } = useLocaleDirection();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: spaces, isLoading, error } = useSpaces();
  const createMutation = useCreateSpace();
  const updateMutation = useUpdateSpace();
  const deleteMutation = useDeleteSpace();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);

  const rawSpacesList = Array.isArray(spaces) ? spaces : spaces?.spaces || [];
  const normalizedSpaces = rawSpacesList.map((space) => ({
    ...space,
    gradient: space.gradient || "from-indigo-500 to-indigo-400",
    initials: space.initials || (space.name ? space.name.charAt(0).toUpperCase() : "S"),
    isOwner: space.isOwner !== undefined ? space.isOwner : space.role === "OWNER",
    stats: {
      departments: space.stats?.departments ?? space._count?.departments ?? 0,
      boards: space.stats?.boards ?? space._count?.boards ?? 0,
      members: space.stats?.members ?? space._count?.memberships ?? space.memberCount ?? 1,
    },
    departments: space.departments || [],
  }));

  const remaining = Math.max(0, QUOTA.total - normalizedSpaces.length);

  useEffect(() => {
    setPath([
      {
        name: t("common.workspace"),
        color: "text-slate-400",
        ref: "",
      },
      {
        name: t("spacesPage.headerTitle"),
        color: "text-slate-800",
        ref: "",
      },
    ]);
  }, [setPath, t]);

  const handleCreateSpaceSubmit = async (data) => {
    try {
      await createMutation.mutateAsync(data);
      setShowCreateModal(false);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, t("spacesPage.createSpaceFailed")));
    }
  };

  const handleUpdateSpaceSubmit = async (data) => {
    try {
      await updateMutation.mutateAsync({ spaceId: editingSpace.id, data });
      setEditingSpace(null);
    } catch (requestError) {
      toast.error(getErrorMessage(requestError, t("spacesPage.updateSpaceFailed")));
    }
  };

  const handleDeleteSpace = (spaceId) => {
    const confirmation = window.confirm(t("spacesPage.deleteWorkspaceConfirm"));
    if (!confirmation) return;

    deleteMutation.mutate(spaceId, {
      onSuccess: () => {
        const currentActive = readActiveSpaceId();
        if (currentActive === spaceId) {
          removeActiveSpaceId();
        }
      },
      onError: (requestError) => {
        toast.error(getErrorMessage(requestError, t("spacesPage.deleteWorkspaceFailed")));
      },
    });
  };

  const handleInviteMembers = (spaceId) => {
    writeActiveSpaceId(spaceId);
    navigate("/settings/members");
  };

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900" dir={dir}>
        <main className={`flex-1 overflow-y-auto px-8 py-8 ${isRTL ? "text-right" : "text-left"}`} aria-label={t("spacesPage.pageAria")}>
          <div className="mx-auto max-w-[1100px]">
            <SpacesHeader onNewSpace={() => setShowCreateModal(true)} />

            <QuotaBanner
              used={normalizedSpaces.length}
              total={QUOTA.total}
              onUpgrade={() => toast.info(t("spacesPage.upgradeToast"))}
            />

            <div className="flex flex-col gap-6" role="list" aria-label={t("spacesPage.listAria")}>
              {isLoading ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center font-medium text-slate-500 animate-pulse">
                  <svg className="h-6 w-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t("spacesPage.loading")}</span>
                </div>
              ) : error ? (
                <div className="py-12 text-center font-medium text-red-500">
                  {t("spacesPage.loadError", { message: error.message || t("common.unknown") })}
                </div>
              ) : normalizedSpaces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 py-12 text-center font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  {t("spacesPage.empty")}
                </div>
              ) : (
                normalizedSpaces.map((space) => (
                  <div key={space.id} role="listitem">
                    <SpaceCard
                      space={space}
                      onEdit={(item) => setEditingSpace(item)}
                      onDelete={handleDeleteSpace}
                      onInvite={handleInviteMembers}
                    />
                  </div>
                ))
              )}

              {!isLoading && !error ? (
                <CreateSpaceCard
                  remaining={remaining}
                  onClick={() => setShowCreateModal(true)}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

      {showCreateModal ? (
        <CreateSpaceModal
          onSubmit={handleCreateSpaceSubmit}
          onClose={() => setShowCreateModal(false)}
        />
      ) : null}

      {editingSpace ? (
        <CreateSpaceModal
          isEdit={true}
          space={editingSpace}
          onSubmit={handleUpdateSpaceSubmit}
          onClose={() => setEditingSpace(null)}
        />
      ) : null}
    </>
  );
}
