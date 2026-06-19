/**
 * Permissions Seed Script
 *
 * Seeds the canonical set of roles and permissions into the database.
 * Safe to run multiple times — uses upsert everywhere.
 *
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed-permissions.ts
 * Or:  npm run seed:permissions
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Permission Matrix ──────────────────────────────────────────────────────
// Each entry: [action, resource, description]
// action:   'create' | 'read' | 'update' | 'delete' | 'approve' | 'manage'
// resource: 'task' | 'board' | 'space' | 'member' | 'report' | 'ai_action'

const PERMISSIONS: Array<[string, string, string]> = [
  // Tasks
  ['create', 'task', 'Create new tasks in any board'],
  ['read', 'task', 'View tasks and their details'],
  ['update', 'task', 'Edit task title, description, status, priority'],
  ['delete', 'task', 'Archive or delete tasks'],
  ['manage', 'task', 'Full task management including bulk operations'],
  // Boards
  ['create', 'board', 'Create boards and departments'],
  ['read', 'board', 'View boards and their configuration'],
  ['update', 'board', 'Edit board settings and columns'],
  ['delete', 'board', 'Delete or archive boards and departments'],
  ['manage', 'board', 'Full board management including department operations'],
  // Spaces
  ['read', 'space', 'View space details and settings'],
  ['update', 'space', 'Edit space name, icon, color, settings'],
  ['delete', 'space', 'Delete the space and all its data'],
  ['manage', 'space', 'Full space management including dangerous operations'],
  // Members
  ['read', 'member', 'View member list and their roles'],
  ['manage', 'member', 'Invite, remove, and change roles of members'],
  // Reports
  ['read', 'report', 'View analytics and generated reports'],
  ['create', 'report', 'Generate new reports'],
  // AI Actions
  ['read', 'ai_action', 'View AI proposed actions'],
  ['approve', 'ai_action', 'Approve or reject AI proposed actions'],
  ['manage', 'ai_action', 'Full AI action management'],
];

// ─── Role → Permission mapping ──────────────────────────────────────────────
const ROLE_PERMISSIONS: Record<string, Array<[string, string]>> = {
  OWNER: [
    // Owners have all permissions
    ...PERMISSIONS.map(([action, resource]) => [action, resource] as [string, string]),
  ],
  ADMIN: [
    // All permissions EXCEPT space deletion and dangerous space management
    ['create', 'task'], ['read', 'task'], ['update', 'task'], ['delete', 'task'], ['manage', 'task'],
    ['create', 'board'], ['read', 'board'], ['update', 'board'], ['delete', 'board'], ['manage', 'board'],
    ['read', 'space'], ['update', 'space'],                // NOT delete or manage
    ['read', 'member'], ['manage', 'member'],
    ['read', 'report'], ['create', 'report'],
    ['read', 'ai_action'], ['approve', 'ai_action'], ['manage', 'ai_action'],
  ],
  HEAD: [
    // Department-level leadership — can manage tasks and boards, limited member access
    ['create', 'task'], ['read', 'task'], ['update', 'task'], ['delete', 'task'],
    ['read', 'board'], ['update', 'board'],
    ['read', 'space'],
    ['read', 'member'],
    ['read', 'report'],
    ['read', 'ai_action'], ['approve', 'ai_action'],
  ],
  MEMBER: [
    // Regular team member — create and update their own tasks
    ['create', 'task'], ['read', 'task'], ['update', 'task'],
    ['read', 'board'],
    ['read', 'space'],
    ['read', 'member'],
    ['read', 'ai_action'],
  ],
  VIEWER: [
    // Read-only observer
    ['read', 'task'],
    ['read', 'board'],
    ['read', 'space'],
    ['read', 'member'],
  ],
};

async function main() {
  console.log('🌱 Seeding permissions and roles...');

  // 1. Upsert all permissions
  const permMap = new Map<string, string>(); // "action:resource" → id

  for (const [action, resource, description] of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { action_resource: { action, resource } },
      update: { description },
      create: { action, resource, description },
    });
    permMap.set(`${action}:${resource}`, perm.id);
    console.log(`  ✓ Permission: ${action}:${resource}`);
  }

  // 2. Upsert all roles
  const roleMap = new Map<string, string>(); // name → id

  const roles = [
    { name: 'OWNER', description: 'Full control over the space — cannot be removed.' },
    { name: 'ADMIN', description: 'Manages members, boards, and tasks. Cannot delete the space.' },
    { name: 'HEAD', description: 'Department lead — manages boards and tasks within their department.' },
    { name: 'MEMBER', description: 'Regular team member — creates and manages tasks.' },
    { name: 'VIEWER', description: 'Read-only observer — cannot create or edit anything.' },
  ];

  for (const role of roles) {
    const r = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
    roleMap.set(r.name, r.id);
    console.log(`  ✓ Role: ${r.name}`);
  }

  // 3. Assign permissions to roles
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleName);
    if (!roleId) continue;

    for (const [action, resource] of perms) {
      const permId = permMap.get(`${action}:${resource}`);
      if (!permId) {
        console.warn(`  ⚠ Permission ${action}:${resource} not found for role ${roleName}`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
    console.log(`  ✓ Assigned ${perms.length} permissions to role: ${roleName}`);
  }

  console.log('\n✅ Permissions seed complete!');
  console.log(`   ${PERMISSIONS.length} permissions`);
  console.log(`   ${roles.length} roles`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
