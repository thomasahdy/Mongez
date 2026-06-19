import { PrismaService } from '../../src/infrastructure/database/prisma.service';

export async function cleanDatabase(prisma: PrismaService) {
  // Fetch all user-created tables (excluding Prisma migration table)
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '_prisma_migrations';
  `;

  if (tables.length === 0) return;

  // Build a single TRUNCATE … CASCADE statement for all tables at once.
  // This is dramatically faster than truncating each table individually.
  const tableList = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);

  // Seeding roles & permissions for integration tests to prevent 403 authorization failures
  const PERMISSIONS: Array<[string, string]> = [
    ['create', 'task'], ['read', 'task'], ['update', 'task'], ['delete', 'task'], ['manage', 'task'],
    ['create', 'board'], ['read', 'board'], ['update', 'board'], ['delete', 'board'], ['manage', 'board'],
    ['read', 'space'], ['update', 'space'], ['delete', 'space'], ['manage', 'space'],
    ['read', 'member'], ['manage', 'member'],
    ['read', 'report'], ['create', 'report'],
    ['read', 'ai_action'], ['approve', 'ai_action'], ['manage', 'ai_action'],
    ['manage', 'workflow'],
  ];

  const ROLE_PERMISSIONS: Record<string, Array<[string, string]>> = {
    OWNER: PERMISSIONS,
    ADMIN: [
      ['create', 'task'], ['read', 'task'], ['update', 'task'], ['delete', 'task'], ['manage', 'task'],
      ['create', 'board'], ['read', 'board'], ['update', 'board'], ['delete', 'board'], ['manage', 'board'],
      ['read', 'space'], ['update', 'space'],
      ['read', 'member'], ['manage', 'member'],
      ['read', 'report'], ['create', 'report'],
      ['read', 'ai_action'], ['approve', 'ai_action'], ['manage', 'ai_action'],
      ['manage', 'workflow'],
    ],
    HEAD: [
      ['create', 'task'], ['read', 'task'], ['update', 'task'], ['delete', 'task'],
      ['read', 'board'], ['update', 'board'],
      ['read', 'space'],
      ['read', 'member'],
      ['read', 'report'],
      ['read', 'ai_action'], ['approve', 'ai_action'],
    ],
    MEMBER: [
      ['create', 'task'], ['read', 'task'], ['update', 'task'],
      ['read', 'board'],
      ['read', 'space'],
      ['read', 'member'],
      ['read', 'ai_action'],
    ],
    VIEWER: [
      ['read', 'task'],
      ['read', 'board'],
      ['read', 'space'],
      ['read', 'member'],
    ],
  };

  const permMap = new Map<string, string>();
  for (const [action, resource] of PERMISSIONS) {
    const perm = await prisma.permission.create({
      data: { action, resource, description: `${action} ${resource}` }
    });
    permMap.set(`${action}:${resource}`, perm.id);
  }

  for (const [roleName, permissionsList] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.create({
      data: { name: roleName, description: `${roleName} role` }
    });

    const rolePerms = permissionsList.map(([action, resource]) => {
      const permissionId = permMap.get(`${action}:${resource}`);
      if (!permissionId) return null;
      return { roleId: role.id, permissionId };
    }).filter((p): p is { roleId: string; permissionId: string } => p !== null);

    if (rolePerms.length > 0) {
      await prisma.rolePermission.createMany({
        data: rolePerms,
      });
    }
  }
}

