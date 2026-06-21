import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { getAuthCookie } from './helpers/auth-helper';

describe('Tenant Context Resolution & Isolation (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let userCookiesA: string[];
  let userCookiesB: string[];
  let userA: any;
  let userB: any;
  let spaceA: any;
  let spaceB: any;
  let deptA: any;
  let deptB: any;
  let boardA: any;
  let boardB: any;
  let taskA: any;
  let taskB: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // 1. Create Users
    userA = await factories.createUser({ email: 'user-a@mongez.test', name: 'User A' });
    userB = await factories.createUser({ email: 'user-b@mongez.test', name: 'User B' });

    userCookiesA = await getAuthCookie(app, 'user-a@mongez.test');
    userCookiesB = await getAuthCookie(app, 'user-b@mongez.test');

    // 2. Create Spaces
    spaceA = await factories.createSpace({ name: 'Space A', prefix: 'SPA' });
    spaceB = await factories.createSpace({ name: 'Space B', prefix: 'SPB' });

    // 3. Set up memberships (User A is in Space A, User B is in Space B)
    await factories.createMembership(userA.id, spaceA.id, 'OWNER');
    await factories.createMembership(userB.id, spaceB.id, 'OWNER');

    // 4. Set up departments
    deptA = await factories.createDepartment(spaceA.id, { name: 'Dept A' });
    deptB = await factories.createDepartment(spaceB.id, { name: 'Dept B' });

    // 5. Set up boards
    boardA = await factories.createBoard(deptA.id, { name: 'Board A' });
    boardB = await factories.createBoard(deptB.id, { name: 'Board B' });

    // 6. Set up tasks
    taskA = await factories.createTask(boardA.id, userA.id, { title: 'Task A' });
    taskB = await factories.createTask(boardB.id, userB.id, { title: 'Task B' });
  });

  describe('Tenant Context Isolation', () => {
    it('should allow User A to access tasks in Space A', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskA.id}`)
        .set('Cookie', userCookiesA)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(taskA.id);
    });

    it('should block User A from accessing tasks in Space B (cross-tenant check)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskB.id}`)
        .set('Cookie', userCookiesA)
        .expect(403); // Forbidden access
    });

    it('should return 404 for a non-existent task', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/tasks/non-existent-task-id')
        .set('Cookie', userCookiesA)
        .expect(404);
    });

    it('should block access to a soft-deleted board', async () => {
      // Archive (soft delete) Board B
      await prisma.board.update({
        where: { id: boardB.id },
        data: { isArchived: true, deletedAt: new Date() },
      });

      // User B trying to access archived board B
      await request(app.getHttpServer())
        .get(`/api/v1/boards/${boardB.id}`)
        .set('Cookie', userCookiesB)
        .expect(404); // Accessing archived board returns not found by guard
    });
  });
});
