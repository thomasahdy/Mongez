import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import SpaceCard from "./SpaceCard";
import SpacesHeader from "./SpacesHeader";
import CreateSpaceCard from "./CreateSpaceCard";
import QuotaBanner from "./QuotaBanner";
import CreateSpaceModal from "./CreateSpaceModal";
import { useSpaces, useCreateSpace, useUpdateSpace, useDeleteSpace } from "../../hooks/api/useSpaces";
 
const QUOTA = { total: 5 };

let path = [
  {
    name: "Al-Noor Foundation",
    color: "text-slate-400",
    ref: ""
  },
  {
    name: "Spaces & Structure",
    color: "text-slate-800",
    ref: ""
  },
];
 
export default function SpacesPage({ setPath }) {
  const navigate = useNavigate();
  const { data: spaces, isLoading, error } = useSpaces();
  const createMutation = useCreateSpace();
  const updateMutation = useUpdateSpace();
  const deleteMutation = useDeleteSpace();

  // Modal display states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);

  // Normalize backend spaces to support UI features
  const rawSpacesList = Array.isArray(spaces) ? spaces : (spaces?.spaces || []);
  const normalizedSpaces = rawSpacesList.map((space) => ({
    ...space,
    gradient: space.gradient || 'from-indigo-500 to-indigo-400',
    initials: space.initials || (space.name ? space.name.charAt(0).toUpperCase() : 'S'),
    isOwner: space.isOwner !== undefined ? space.isOwner : space.role === 'OWNER',
    stats: {
      departments: space.stats?.departments ?? space._count?.departments ?? 0,
      boards: space.stats?.boards ?? space._count?.boards ?? 0,
      members: space.stats?.members ?? space._count?.memberships ?? space.memberCount ?? 1,
    },
    departments: space.departments || [],
  }));

  const remaining = Math.max(0, QUOTA.total - normalizedSpaces.length);

  useEffect(() => {
    setPath(path);
  }, [setPath]);

  // Handle Workspace creation submission
  const handleCreateSpaceSubmit = async (data) => {
    try {
      await createMutation.mutateAsync(data);
      setShowCreateModal(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to create space.");
    }
  };

  // Handle Workspace update submission
  const handleUpdateSpaceSubmit = async (data) => {
    try {
      await updateMutation.mutateAsync({ spaceId: editingSpace.id, data });
      setEditingSpace(null);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to update space.");
    }
  };

  // Handle Workspace cascading deletion
  const handleDeleteSpace = (spaceId) => {
    const confirmation = window.confirm(
      "Are you sure you want to delete this workspace? This will cascade and delete all departments, boards, and tasks. This action is permanent and cannot be undone."
    );
    if (confirmation) {
      deleteMutation.mutate(spaceId, {
        onSuccess: () => {
          // If the deleted space was selected as active, reset the UI active ID
          const currentActive = localStorage.getItem('activeSpaceId');
          if (currentActive === spaceId) {
            localStorage.removeItem('activeSpaceId');
          }
        },
        onError: (err) => {
          alert(err.response?.data?.message || err.message || "Failed to delete workspace.");
        }
      });
    }
  };

  // Handle member invitation click
  const handleInviteMembers = (spaceId) => {
    // Set space context as active, then navigate to member settings
    localStorage.setItem('activeSpaceId', spaceId);
    navigate('/settings/members');
  };

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto px-8 py-8" aria-label="Spaces and structure">
          <div className="max-w-[1100px] mx-auto">

            <SpacesHeader onNewSpace={() => setShowCreateModal(true)} />

            <QuotaBanner
              used={normalizedSpaces.length}
              total={QUOTA.total}
              onUpgrade={() => alert("Upgrade to business plan to add more spaces!")}
            />

            {/* Space cards */}
            <div className="flex flex-col gap-6" role="list" aria-label="Spaces">
              {isLoading ? (
                <div className="text-center py-12 text-slate-500 font-medium animate-pulse flex flex-col items-center gap-2">
                  <svg className="w-6 h-6 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading workspaces...</span>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-red-500 font-medium">
                  Error loading spaces: {error.message || "Unknown error occurred"}
                </div>
              ) : normalizedSpaces.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-medium border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 p-10">
                  No spaces found. Complete onboarding or click "New Space" to get started!
                </div>
              ) : (
                normalizedSpaces.map((space) => (
                  <div key={space.id} role="listitem">
                    <SpaceCard 
                      space={space}
                      onEdit={(s) => setEditingSpace(s)}
                      onDelete={handleDeleteSpace}
                      onInvite={handleInviteMembers}
                    />
                  </div>
                ))
              )}

              {/* Create new card */}
              {!isLoading && !error && (
                <CreateSpaceCard
                  remaining={remaining}
                  onClick={() => setShowCreateModal(true)}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <CreateSpaceModal
          onSubmit={handleCreateSpaceSubmit}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Workspace Modal */}
      {editingSpace && (
        <CreateSpaceModal
          isEdit={true}
          space={editingSpace}
          onSubmit={handleUpdateSpaceSubmit}
          onClose={() => setEditingSpace(null)}
        />
      )}
    </>
  );
}