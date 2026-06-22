import apiClient from "./apiClient";

/**
 * Members API Service
 * 
 * Maps NestJS endpoints for space membership, roles management, and invitations.
 */

/**
 * Fetch all members of a specific workspace space, including their roles and details.
 * 
 * @async
 * @function getMembers
 * @param {string} spaceId - Space ID
 * @returns {Promise<Array<Object>>} List of active space member records
 */
export const getMembers = async (spaceId) => {
  const { data } = await apiClient.get(`/spaces/${spaceId}/members`);
  return data;
};

/**
 * Change the role of a user inside a space.
 * Requester must have OWNER or ADMIN roles.
 * 
 * @async
 * @function updateMemberRole
 * @param {string} spaceId - Space ID
 * @param {string} userId - User ID to update
 * @param {string} role - New role name ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')
 * @returns {Promise<Object>} Updated membership details
 */
export const updateMemberRole = async (spaceId, userId, role) => {
  const response = await apiClient.patch(`/spaces/${spaceId}/members/${userId}/role`, { role });
  return response.data;
};

/**
 * Evict/remove a member from a space.
 * Requester must have OWNER or ADMIN roles.
 * 
 * @async
 * @function removeMember
 * @param {string} spaceId - Space ID
 * @param {string} userId - User ID to remove
 * @returns {Promise<void>}
 */
export const removeMember = async (spaceId, userId) => {
  await apiClient.delete(`/spaces/${spaceId}/members/${userId}`);
};

/**
 * Send an email invitation to join a workspace space.
 * Requester must have OWNER or ADMIN roles.
 * 
 * @async
 * @function inviteMember
 * @param {string} spaceId - Space ID
 * @param {Object} data - Invitation details
 * @param {string} data.email - Recipient email address
 * @param {string} [data.role='MEMBER'] - Role assigned upon joining
 * @returns {Promise<Object>} Created invitation details
 */
export const inviteMember = async (spaceId, data) => {
  const response = await apiClient.post(`/spaces/${spaceId}/invitations`, data);
  return response.data;
};

/**
 * Fetch pending invitations for a space.
 * 
 * @async
 * @function getPendingInvitations
 * @param {string} spaceId - Space ID
 * @returns {Promise<Array<Object>>} List of pending invitation records
 */
export const getPendingInvitations = async (spaceId) => {
  const response = await apiClient.get(`/spaces/${spaceId}/invitations`);
  return response.data;
};

/**
 * Cancel a pending workspace invitation.
 * Requester must have OWNER or ADMIN roles.
 * 
 * @async
 * @function cancelInvitation
 * @param {string} spaceId - Space ID
 * @param {string} inviteId - Invitation ID to revoke
 * @returns {Promise<void>}
 */
export const cancelInvitation = async (spaceId, inviteId) => {
  await apiClient.delete(`/spaces/${spaceId}/invitations/${inviteId}`);
};

const membersService = {
  getMembers,
  updateMemberRole,
  removeMember,
  inviteMember,
  getPendingInvitations,
  cancelInvitation,
};

export default membersService;
