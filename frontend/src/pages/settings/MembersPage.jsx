import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import SettingsSidebar from './sections/SettingsSidebar';
import InviteMemberModal from './InviteMemberModal';
import { useSpace } from '../../hooks/api/useSpaces';
import {
  useMembers,
  useInvites,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  useCancelInvite,
} from '../../hooks/api/useMembers';

/**
 * Component: MembersPage
 * 
 * Workspace Settings subpage. Exposes member list, role updates, eviction actions, 
 * email invitation submissions, and pending invite cancellations.
 * Reuses the sidebar settings navigation layout.
 */
export default function MembersPage({ setPath }) {
  const [activeSpaceId, setActiveSpaceId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Get current logged-in user details to prevent self-eviction
  const currentUser = useSelector((state) => state.users?.user);

  useEffect(() => {
    const savedSpaceId = localStorage.getItem('activeSpaceId');
    setActiveSpaceId(savedSpaceId);

    // Set page path header context
    if (setPath) {
      setPath([
        { name: "Settings", color: "text-slate-400", ref: "/settings" },
        { name: "Members & Roles", color: "text-slate-800", ref: "" },
      ]);
    }
  }, [setPath]);

  // React Query queries and mutations
  const { data: spaceDetails } = useSpace(activeSpaceId);
  const { data: members, isLoading: loadingMembers, error: errorMembers } = useMembers(activeSpaceId);
  const { data: invites, isLoading: loadingInvites } = useInvites(activeSpaceId);

  const inviteMutation = useInviteMember();
  const updateRoleMutation = useUpdateMemberRole();
  const removeMutation = useRemoveMember();
  const cancelInviteMutation = useCancelInvite();

  // Invite member submission handler
  const handleInviteSubmit = async (data) => {
    await inviteMutation.mutateAsync(
      { spaceId: activeSpaceId, data },
      {
        onSuccess: () => {
          setShowInviteModal(false);
          alert('Invitation sent successfully!');
        },
        onError: (err) => {
          alert(err.response?.data?.message || err.message || 'Failed to send invitation');
        },
      }
    );
  };

  // Change member role handler
  const handleRoleChange = async (userId, newRole) => {
    const confirmation = window.confirm(`Are you sure you want to change this user's role to ${newRole}?`);
    if (!confirmation) return;

    await updateRoleMutation.mutateAsync(
      { spaceId: activeSpaceId, userId, role: newRole },
      {
        onSuccess: () => {
          alert('User role updated successfully');
        },
        onError: (err) => {
          alert(err.response?.data?.message || err.message || 'Failed to update member role');
        },
      }
    );
  };

  // Evict member handler
  const handleRemoveMember = async (userId, name) => {
    const confirmation = window.confirm(`Are you sure you want to remove ${name} from this workspace?`);
    if (!confirmation) return;

    await removeMutation.mutateAsync(
      { spaceId: activeSpaceId, userId },
      {
        onSuccess: () => {
          alert('Member removed successfully');
        },
        onError: (err) => {
          alert(err.response?.data?.message || err.message || 'Failed to remove member');
        },
      }
    );
  };

  // Cancel invitation handler
  const handleCancelInvite = async (inviteId, email) => {
    const confirmation = window.confirm(`Are you sure you want to cancel the invitation sent to ${email}?`);
    if (!confirmation) return;

    await cancelInviteMutation.mutateAsync(
      { spaceId: activeSpaceId, inviteId },
      {
        onSuccess: () => {
          alert('Invitation cancelled successfully');
        },
        onError: (err) => {
          alert(err.response?.data?.message || err.message || 'Failed to cancel invitation');
        },
      }
    );
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Settings Navigation Sidebar */}
      <SettingsSidebar activeId="members" />

      {/* Main Settings Page Area */}
      <main className="flex-1 overflow-y-auto" aria-label="Workspace Member management">
        <div className="px-8 py-6 max-w-[850px] mx-auto space-y-8">
          
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h1 className="text-[20px] font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-1">
                Members &amp; Roles
              </h1>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                Manage who has access to the workspace <span className="font-semibold text-slate-800 dark:text-slate-200">"{spaceDetails?.name || 'Active Workspace'}"</span> and their permissions.
              </p>
            </div>
            
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:shadow-md text-white transition-all duration-200 cursor-pointer flex items-center gap-2 self-start sm:self-auto"
            >
              <i className="fa-solid fa-user-plus text-xs" /> Invite Member
            </button>
          </div>

          {/* Members List */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-900">
              <h2 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Active Workspace Members</h2>
            </div>

            {loadingMembers ? (
              <div className="p-10 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2 animate-pulse">
                <svg className="w-5 h-5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs">Loading members list...</span>
              </div>
            ) : errorMembers ? (
              <div className="p-8 text-center text-red-500 text-sm">
                Error loading members: {errorMembers.message || 'Verify your space owner permissions.'}
              </div>
            ) : members?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active members found in this space.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-900">
                {members.map((member) => {
                  const userDetail = member.user || {};
                  const isCurrentUser = userDetail.id === currentUser?.id;
                  const isOwnerRole = member.role?.name === 'OWNER';

                  return (
                    <div key={userDetail.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        {userDetail.avatarUrl ? (
                          <img src={userDetail.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-100" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                            {userDetail.name ? userDetail.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}

                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {userDetail.name || 'Unknown User'}
                            {isCurrentUser && (
                              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">You</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">{userDetail.email}</div>
                        </div>
                      </div>

                      {/* Member Actions */}
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        {/* Role Select Dropdown */}
                        <div className="relative">
                          <select
                            disabled={isOwnerRole || isCurrentUser}
                            value={member.role?.name || 'MEMBER'}
                            onChange={(e) => handleRoleChange(userDetail.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold bg-white dark:bg-slate-900 focus:ring-1 focus:ring-sky-400 focus:border-transparent outline-none cursor-pointer
                              ${isOwnerRole ? 'border-amber-200 text-amber-600 bg-amber-50/20 dark:bg-amber-950/10 cursor-not-allowed' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350'}`}
                          >
                            {isOwnerRole ? (
                              <option value="OWNER">Owner</option>
                            ) : (
                              <>
                                <option value="ADMIN">Admin</option>
                                <option value="MEMBER">Member</option>
                                <option value="VIEWER">Viewer</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Evict/Remove Member Button */}
                        {!isOwnerRole && !isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(userDetail.id, userDetail.name)}
                            className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                            title="Remove Member"
                          >
                            <i className="fa-solid fa-trash-can text-sm" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invitations Section */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-900">
              <h2 className="text-[14px] font-bold text-slate-800 dark:text-slate-200">Pending Email Invites</h2>
            </div>

            {loadingInvites ? (
              <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
                Loading pending invites...
              </div>
            ) : invites?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs leading-relaxed">
                No pending invitations. Click "Invite Member" above to invite coworkers.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-900">
                {invites?.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-5 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-350">{invite.email}</div>
                      <div className="flex gap-2 items-center text-xxs text-slate-400">
                        <span className="font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">{invite.role}</span>
                        <span>•</span>
                        <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelInvite(invite.id, invite.email)}
                      className="px-3 py-1.5 text-xs font-semibold border border-red-200 dark:border-red-950 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors cursor-pointer"
                      title="Cancel Invitation"
                    >
                      Revoke Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Invite Member Popup Modal */}
      {showInviteModal && (
        <InviteMemberModal
          onSubmit={handleInviteSubmit}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}
