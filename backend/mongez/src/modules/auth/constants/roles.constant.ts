/**
 * Default role definitions for the application
 */
export const DEFAULT_ROLES = [
  {
    name: 'OWNER',
    description: 'Full access to all resources and settings',
    permissions: ['*'],
  },
  {
    name: 'ADMIN',
    description: 'Administrative access within their space',
    permissions: [
      'users:read',
      'users:write',
      'spaces:read',
      'spaces:write',
      'departments:read',
      'departments:write',
      'boards:read',
      'boards:write',
      'tasks:read',
      'tasks:write',
      'invites:read',
      'invites:write',
    ],
  },
  {
    name: 'MEMBER',
    description: 'Standard member with read/write access to assigned resources',
    permissions: [
      'spaces:read',
      'departments:read',
      'boards:read',
      'boards:write',
      'tasks:read',
      'tasks:write',
    ],
  },
  {
    name: 'VIEWER',
    description: 'Read-only access to shared resources',
    permissions: [
      'spaces:read',
      'departments:read',
      'boards:read',
      'tasks:read',
    ],
  },
];

/**
 * Role names for type safety
 */
export enum RoleName {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}