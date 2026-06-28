import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Migration Integrity & Schema Evolution (Layer 8)', () => {
  let prisma: PrismaService;
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const backupDir = path.resolve(__dirname, '../prisma/migrations_backup');
  const targetMigrations = [
    '20260620120707_add_governance_models',
    '20260623213943_add_integration_relations',
    '20260625000000_add_task_views',
  ];

  beforeAll(async () => {
    // 1. Move target migrations to backup
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    for (const migration of targetMigrations) {
      const src = path.join(migrationsDir, migration);
      const bkp = path.join(backupDir, migration);
      if (fs.existsSync(src)) {
        fs.renameSync(src, bkp);
      }
    }

    // 2. Instantiate direct PrismaService
    prisma = new PrismaService();
    await prisma.onModuleInit();

    // 3. Drop existing database schema to ensure clean slate
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);

    // 4. Deploy initial migrations (without governance models and subsequent ones)
    console.log('Deploying initial migrations...');
    execSync('npx prisma migrate deploy', {
      env: { ...process.env },
      cwd: path.resolve(__dirname, '..'),
    });
  });

  afterAll(async () => {
    // Restore all migration folders
    for (const migration of targetMigrations) {
      const src = path.join(migrationsDir, migration);
      const bkp = path.join(backupDir, migration);
      if (fs.existsSync(bkp)) {
        if (fs.existsSync(src)) {
          fs.rmSync(bkp, { recursive: true, force: true });
        } else {
          fs.renameSync(bkp, src);
        }
      }
    }
    if (fs.existsSync(backupDir) && fs.readdirSync(backupDir).length === 0) {
      fs.rmdirSync(backupDir);
    }

    // Restore full database schema for subsequent tests
    try {
      console.log('Restoring test database schema for other tests...');
      const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
      execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss --force-reset`, {
        stdio: 'inherit',
        env: { ...process.env },
      });
    } catch (err) {
      console.error('Failed to restore schema in afterAll:', err);
    }

    if (prisma) {
      await prisma.onModuleDestroy();
    }
  });

  it('should preserve data across migration and successfully run latest migrations', async () => {
    // 1. Seed legacy-realistic data (using tables existing prior to targetMigration)
    const spaceId = 'mig-test-space-id';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "spaces" (id, name, prefix, "createdAt", "updatedAt")
      VALUES ('${spaceId}', 'Legacy Space', 'LEG', NOW(), NOW());
    `);

    const userId = 'mig-test-user-id';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "users" (id, email, name, "passwordHash", status, "isVerified", provider, "createdAt", "updatedAt")
      VALUES ('${userId}', 'migration-legacy@mongez.test', 'Legacy User', 'somehash', 'ACTIVE'::"UserStatus", true, 'LOCAL', NOW(), NOW());
    `);

    const deptId = 'mig-dept-id';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "departments" (id, "spaceId", name, "createdAt")
      VALUES ('${deptId}', '${spaceId}', 'Engineering', NOW());
    `);

    const boardId = 'mig-board-id';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "boards" (id, "departmentId", name, type, "createdAt", "updatedAt")
      VALUES ('${boardId}', '${deptId}', 'Legacy Board', 'KANBAN'::"BoardType", NOW(), NOW());
    `);

    const columnId = 'mig-col-id';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "board_columns" (id, "boardId", name, position)
      VALUES ('${columnId}', '${boardId}', 'Todo', 0);
    `);

    const taskId = 'mig-task-id';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "tasks" (id, identifier, title, "boardId", "columnId", status, priority, "createdById", position, "createdAt", "updatedAt")
      VALUES ('${taskId}', 'LEG-1', 'Legacy Task', '${boardId}', '${columnId}', 'TODO'::"TaskStatus", 'MEDIUM'::"Priority", '${userId}', 0, NOW(), NOW());
    `);

    // Verify initial count
    const taskCountBefore = await prisma.$queryRaw<any[]>`SELECT count(*) FROM tasks;`;
    expect(Number(taskCountBefore[0].count)).toBe(1);

    // 2. Move target migrations back from backup
    for (const migration of targetMigrations) {
      const src = path.join(migrationsDir, migration);
      const bkp = path.join(backupDir, migration);
      if (fs.existsSync(bkp)) {
        if (!fs.existsSync(src)) {
          fs.renameSync(bkp, src);
        }
      }
    }

    // 3. Deploy all remaining migrations on top of the seeded DB
    console.log('Deploying remaining migrations...');
    execSync('npx prisma migrate deploy', {
      env: { ...process.env },
      cwd: path.resolve(__dirname, '..'),
    });

    // 4. Assert: Seeded data is fully preserved and untouched
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toBeDefined();
    expect(user!.email).toBe('migration-legacy@mongez.test');
    expect(user!.name).toBe('Legacy User');

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    expect(task).toBeDefined();
    expect(task!.title).toBe('Legacy Task');
    expect(task!.boardId).toBe(boardId);

    // 5. Assert: New tables are created successfully and can be queried without throwing SQL errors
    const activitiesCount = await prisma.userActivity.count();
    expect(activitiesCount).toBe(0);

    const delegationCount = await prisma.userDelegation.count();
    expect(delegationCount).toBe(0);

    const slaCount = await prisma.slaMetric.count();
    expect(slaCount).toBe(0);

    const viewsCount = await prisma.savedView.count();
    expect(viewsCount).toBe(0);

    const decisionsCount = await prisma.decisionRecord.count();
    expect(decisionsCount).toBe(0);
  });
});
