import React, { useState } from 'react';
import SpaceCardHeader from './SpaceCardHeader';
import DepartmentRow from './DepartmentRow';
import { useInviteMember } from '../../hooks/api/useMembers';
import { useCreateDepartment, useSpaceDepartments } from '../../hooks/api/useSpaces';

/**
 * Component: SpaceCard
 * 
 * Renders a single workspace card with its departments, supporting toggle collapse,
 * edit actions, invite redirects, and deletion actions.
 * 
 * @param {Object} props
 * @param {Object} props.space - Space data record
 * @param {Function} props.onEdit - Edit workspace callback
 * @param {Function} props.onDelete - Delete workspace callback
 * @param {Function} props.onInvite - Invite members callback
 */
const SpaceCard = ({ space, onEdit, onDelete, onInvite }) => {
  const [expanded, setExpanded] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateDepModal, setShowCreateDepModal] = useState(false);
  const inviteMember = useInviteMember()
  const createDepartment = useCreateDepartment();

  const { data: departments, isLoading, error } = useSpaceDepartments(space.id);

  const rawDepartmentsList = Array.isArray(departments) ? departments : (departments?.departments || []);

  const normalizedDepartments = rawDepartmentsList.map((dept) => ({
    ...dept,
    color: dept.color || '#6366f1', // Indigo-500 fallback hex color
    initials: dept.initials || (dept.name ? dept.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'D'),

    isAdmin: dept.isAdmin !== undefined ? dept.isAdmin : dept.role === 'ADMIN',

    stats: {
      boards: dept.stats?.boards ?? dept._count?.boards ?? 0,
      members: dept.stats?.members ?? dept._count?.memberships ?? dept._count?.members ?? dept.memberCount ?? 0,
      tasks: dept.stats?.tasks ?? dept._count?.tasks ?? 0,
    },

    // Safe default initializations for related arrays
    boards: dept.boards || [],
    members: dept.members || [],
  }));


  const handleInviteMember = async (data) => {
    try {
      await inviteMember.mutateAsync({ spaceId: space.id, data });
      setShowInviteModal(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to invite a member.");
    }

  }

  const handleCreateDepartment = async (data) => {
    try {
      await createDepartment.mutateAsync({ spaceId: space.id, data: data });

      setShowCreateDepModal(false);



    }
    catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to create department.");
    }

  }


  const handleAddBoard = (deptId) => {
    console.info("Add board to dept:", deptId);
  };

  return (
    <article
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm animate-fadeIn"
      aria-label={`Space: ${space.name}`}
    >
      <SpaceCardHeader
        space={space}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onInvite={() => onInvite(space.id)}
        onSettings={() => onEdit(space)}
        onMore={() => onDelete(space.id)}
      />

      {/* Departments — animated collapse */}
      <div
        className={`transition-all duration-300 overflow-hidden ${expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"}`}
        aria-hidden={!expanded}
      >
        <div className="px-6 pb-5 pt-1">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 font-medium animate-pulse flex flex-col items-center gap-2">
              <svg
                className="w-6 h-6 animate-spin text-indigo-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Loading Departments...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500 font-medium">
              Error loading Departments: {error.message || "Unknown error occurred"}
            </div>
          ) : normalizedDepartments && normalizedDepartments.length > 0 ? (
            normalizedDepartments.map((dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                onAddBoard={handleAddBoard}
              />
            ))
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-3 pl-2">
              No departments registered in this space. Click settings to configure departments.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default SpaceCard;
