import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * @RequirePermissions decorator — marks an endpoint with the permissions needed to access it.
 *
 * Each permission is a tuple of [action, resource] matching the Permission model.
 * The PermissionsGuard reads these and checks against the user's role permissions in the space.
 *
 * Action values:  'create' | 'read' | 'update' | 'delete' | 'approve' | 'manage'
 * Resource values: 'task' | 'board' | 'space' | 'member' | 'report' | 'ai_action'
 *
 * @example
 *   // Single permission
 *   @RequirePermissions(['manage', 'member'])
 *   async inviteMember() { ... }
 *
 *   // Multiple permissions (all required)
 *   @RequirePermissions(['create', 'board'], ['manage', 'board'])
 *   async createBoard() { ... }
 */
export const RequirePermissions = (...permissions: [action: string, resource: string][]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
