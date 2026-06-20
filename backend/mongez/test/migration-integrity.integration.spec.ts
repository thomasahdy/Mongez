import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Migration Integrity & Schema Evolution (Layer 8)', () => {
  let prisma: PrismaService;
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  const backupDir = path.resolve(__dirname, '../prisma/migrations_backup');
  const targetMigration = '20260620120707_add_governance_models';
  const sourcePath = path.join(migrationsDir, targetMigration);
  const backupPath = path.join(backupDir, targetMigration);

  beforeAll(async () => {
    // 1. Move the target migration folder to backup
    if (fs.existsSync(sourcePath)) {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      fs.renameSync(sourcePath, backupPath);
    }

    // 2. Instantiate direct PrismaService
    prisma = new PrismaService();
    await prisma.onModuleInit();

    // 3. Drop existing database schema to ensure clean slate
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`);

    // 4. Deploy initial migrations (without the latest one)
    console.log('Deploying initial migrations (without governance models)...');
    execSync('npx prisma migrate deploy', {
      env: { ...process.env },
      cwd: path.resolve(__dirname, '..'),
    });
  });

  afterAll(async () => {
    // Restore migration folder if still in backup
    if (fs.existsSync(backupPath)) {
      if (fs.existsSync(sourcePath)) {
        // If target already exists for some reason, clean up the backup to avoid conflict
        fs.rmSync(backupPath, { recursive: true, force: true });
      } else {
        fs.renameSync(backupPath, sourcePath);
      }
    }
    if (fs.existsSync(backupDir) && fs.readdirSync(backupDir).length === 0) {
      fs.rmdirSync(backupDir);
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

    // 2. Move the target migration folder back
    if (fs.existsSync(backupPath)) {
      if (!fs.existsSync(sourcePath)) {
        fs.renameSync(backupPath, sourcePath);
      }
    }

    // 3. Deploy the latest migration (governance models) on top of the seeded DB
    console.log('Deploying latest migration (governance models)...');
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
