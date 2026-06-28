import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { UsersService } from '../src/modules/users/users.service';
import { TrashService } from '../src/modules/trash/trash.service';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('GDPR & Disaster Recovery Compliance (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let usersService: UsersService;
  let trashService: TrashService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    usersService = app.get(UsersService);
    trashService = app.get(TrashService);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('User Deletion Anonymization (GDPR)', () => {
    it('should anonymize all user PII fields and suspend status upon GDPR delete', async () => {
      // 1. Create a user with PII data
      const user = await prisma.user.create({
        data: {
          email: 'gdpr-test@mongez.test',
          name: 'Thomas GDPR Test',
          passwordHash: 'somehashval',
          avatarUrl: 'http://cdn.mongez.local/avatar-thomas.png',
          status: 'ACTIVE',
          isVerified: true,
          provider: 'LOCAL',
        },
      });

      // 2. Perform GDPR delete
      await usersService.deleteOwnAccount(user.id);

      // 3. Verify user row still exists (for referential integrity) but is anonymized
      const anonymizedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(anonymizedUser).toBeDefined();
      expect(anonymizedUser!.email).toBe(`deleted+${user.id}@anon.mongez.local`);
      expect(anonymizedUser!.name).toBe('Deleted User');
      expect(anonymizedUser!.avatarUrl).toBeNull();
      expect(anonymizedUser!.passwordHash).toBeNull();
      expect(anonymizedUser!.status).toBe('SUSPENDED');
      expect(anonymizedUser!.isVerified).toBe(false);
      expect(anonymizedUser!.provider).toBe('DELETED');
    });
  });

  describe('Soft-Delete Recovery (Board + Tasks Cascading Recovery)', () => {
    it('should cascade soft-delete and correctly restore board and tasks', async () => {
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const dept = await factories.createDepartment(space.id);
      const board = await factories.createBoard(dept.id);
      const col = await factories.createBoardColumn(board.id);

      // Create a task
      const task = await factories.createTask(board.id, user.id, { columnId: col.id });

      // 1. Soft delete the board via TrashService
      await trashService.softDeleteBoard(board.id, user.id);

      // Verify board and task are soft-deleted (deletedAt is set)
      const softDeletedBoard = await prisma.board.findUnique({ where: { id: board.id } });
      const softDeletedTask = await prisma.task.findUnique({ where: { id: task.id } });

      expect(softDeletedBoard!.deletedAt).not.toBeNull();
      expect(softDeletedTask!.deletedAt).not.toBeNull();
      expect(softDeletedBoard!.restoreToken).toBeDefined();
      expect(softDeletedBoard!.restoreToken).not.toBeNull();
      expect(softDeletedTask!.restoreToken).toBe(softDeletedBoard!.restoreToken);

      // 2. Restore the board via TrashService
      await trashService.restore(board.id);

      // Verify board and task are restored (deletedAt is null, restoreToken is null)
      const restoredBoard = await prisma.board.findUnique({ where: { id: board.id } });
      const restoredTask = await prisma.task.findUnique({ where: { id: task.id } });

      expect(restoredBoard!.deletedAt).toBeNull();
      expect(restoredTask!.deletedAt).toBeNull();
      expect(restoredBoard!.restoreToken).toBeNull();
      expect(restoredTask!.restoreToken).toBeNull();
    });
  });

  describe('Disaster Recovery: PostgreSQL Backup & Restore Cycle', () => {
    it('should correctly backup database state, perform modifications, and restore to original state', async () => {
      // 1. Seed initial data
      const space = await factories.createSpace({ name: 'Backup Space' });
      const user = await factories.createUser({ email: 'backup-user@mongez.test' });

      // 2. Take a database dump using pg_dump via docker exec
      let sqlDump: Buffer;
      try {
        sqlDump = execSync('docker exec mongez_postgres_test pg_dump -c -U mongez_test mongez_db_test', {
          maxBuffer: 20 * 1024 * 1024,
        });
      } catch (err: any) {
        console.warn('Skipping backup-restore cycle test because Docker postgres environment is not accessible: ', err.message);
        return;
      }

      expect(sqlDump).toBeDefined();
      expect(sqlDump.length).toBeGreaterThan(0);

      // Save to temporary file in the workspace
      const backupPath = path.join(__dirname, 'temp-backup.sql');
      fs.writeFileSync(backupPath, sqlDump);

      // 3. Make database modifications: create new user/space
      const newSpace = await factories.createSpace({ name: 'Transient Space' });
      const newUser = await factories.createUser({ email: 'transient@mongez.test' });

      const spaceCountBefore = await prisma.space.count();
      expect(spaceCountBefore).toBe(2);

      // 4. Close NestJS app first to avoid connection pool hanging during dump restore
      await app.close();

      // Restore the database from the backup dump
      execSync('docker exec -i mongez_postgres_test psql -U mongez_test -d mongez_db_test', {
        input: sqlDump,
      });

      // 5. Verify the state has reverted back: Transient Space and User are gone
      // 5. Verify the state has reverted back using a direct Prisma instance
      const directPrisma = new PrismaService();
      await directPrisma.onModuleInit();

      const restoredSpaceCount = await directPrisma.space.count();
      const restoredUserCount = await directPrisma.user.count();

      expect(restoredSpaceCount).toBe(1);
      expect(restoredUserCount).toBe(1);

      const oldSpace = await directPrisma.space.findFirst({ where: { id: space.id } });
      const oldUser = await directPrisma.user.findFirst({ where: { id: user.id } });
      const transientSpace = await directPrisma.space.findFirst({ where: { id: newSpace.id } });

      expect(oldSpace).toBeDefined();
      expect(oldUser).toBeDefined();
      expect(transientSpace).toBeNull();

      await directPrisma.onModuleDestroy();

      // Clean up backup file
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    });
  });
});
