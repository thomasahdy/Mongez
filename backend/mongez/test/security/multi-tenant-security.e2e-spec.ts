import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TestFactories } from '../helpers/factories';
import { cleanDatabase } from '../helpers/db-cleaner';
import { getAuthCookie } from '../helpers/auth-helper';
import { createTestApp } from '../helpers/create-test-app';
import { TaskStatus, Priority } from '@prisma/client';

describe('Multi-Tenant Security Isolation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;

  // Space A resources
  let userA: any;
  let cookieUserA: string[];
  let spaceA: any;
  let boardA: any;
  let colA: any;
  let taskA: any;

  // Space B resources
  let userB: any;
  let cookieUserB: string[];
  let spaceB: any;
  let boardB: any;
  let colB: any;
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

    // Setup Space A
    userA = await factories.createUser({ email: 'usera@mongez.test' });
    cookieUserA = await getAuthCookie(app, 'usera@mongez.test');
    spaceA = await factories.createSpace({ prefix: 'SPA' });
    await factories.createMembership(userA.id, spaceA.id, 'MEMBER');
    const deptA = await factories.createDepartment(spaceA.id);
    boardA = await factories.createBoard(deptA.id);
    colA = await factories.createBoardColumn(boardA.id);
    taskA = await factories.createTask(boardA.id, userA.id, {
      title: 'Task in Space A',
      columnId: colA.id,
    });

    // Setup Space B
    userB = await factories.createUser({ email: 'userb@mongez.test' });
    cookieUserB = await getAuthCookie(app, 'userb@mongez.test');
    spaceB = await factories.createSpace({ prefix: 'SPB' });
    await factories.createMembership(userB.id, spaceB.id, 'MEMBER');
    const deptB = await factories.createDepartment(spaceB.id);
    boardB = await factories.createBoard(deptB.id);
    colB = await factories.createBoardColumn(boardB.id);
    taskB = await factories.createTask(boardB.id, userB.id, {
      title: 'Task in Space B',
      columnId: colB.id,
    });
  });

  describe('Space Isolation Constraints', () => {
    it('should block User A from reading User B tasks (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskB.id}`)
        .set('Cookie', cookieUserA)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('access to this task');
    });

    it('should block User A from reading User B boards (403)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/boards/${boardB.id}`)
        .set('Cookie', cookieUserA)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('access to this board');
    });

    it('should block User A from listing tasks from User B board (403)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/boards/${boardB.id}/tasks`)
        .set('Cookie', cookieUserA)
        .expect(403);
    });

    it('should block User A from creating tasks inside Board B (403)', async () => {
      const taskData = {
        title: 'Malicious Task',
        boardId: boardB.id,
        columnId: colB.id,
        spaceId: spaceB.id,
        spacePrefix: spaceB.prefix,
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
      };

      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Cookie', cookieUserA)
        .send(taskData)
        .expect(403);
    });

    it('should block User A from updating tasks inside Space B (403)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskB.id}`)
        .set('Cookie', cookieUserA)
        .send({ title: 'Hacked Title' })
        .expect(403);
    });

    it('should block User A from commenting on Task B (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskB.id}/comments`)
        .set('Cookie', cookieUserA)
        .send({ content: 'Malicious Comment' })
        .expect(403);
    });

    it('should block User A from deleting tasks inside Space B (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${taskB.id}`)
        .set('Cookie', cookieUserA)
        .expect(403);

      // Verify task is not archived
      const dbTaskB = await prisma.task.findUnique({ where: { id: taskB.id } });
      expect(dbTaskB?.isArchived).toBe(false);
    });
  });
});
