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

describe('Security Isolation (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  
  // Tenants
  let userA: any, userB: any;
  let cookieUserA: string[], cookieUserB: string[];
  
  let spaceA: any, spaceB: any;
  let boardA: any, boardB: any;
  let colA: any, colB: any;
  let taskA: any, taskB: any;

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

    // Create User A & Space A
    userA = await factories.createUser({ email: 'usera@mongez.test' });
    cookieUserA = await getAuthCookie(app, 'usera@mongez.test');
    spaceA = await factories.createSpace({ prefix: 'SPA' });
    await factories.createMembership(userA.id, spaceA.id);
    const deptA = await factories.createDepartment(spaceA.id);
    boardA = await factories.createBoard(deptA.id);
    colA = await factories.createBoardColumn(boardA.id);
    taskA = await factories.createTask(boardA.id, userA.id, { title: 'Task in Space A', columnId: colA.id });

    // Create User B & Space B
    userB = await factories.createUser({ email: 'userb@mongez.test' });
    cookieUserB = await getAuthCookie(app, 'userb@mongez.test');
    spaceB = await factories.createSpace({ prefix: 'SPB' });
    await factories.createMembership(userB.id, spaceB.id);
    const deptB = await factories.createDepartment(spaceB.id);
    boardB = await factories.createBoard(deptB.id);
    colB = await factories.createBoardColumn(boardB.id);
    taskB = await factories.createTask(boardB.id, userB.id, { title: 'Task in Space B', columnId: colB.id });
  });

  describe('Cross-Space Access Prevention', () => {
    it('SEC-AI-003: should prevent User A from accessing tasks in Space B', async () => {
      // User A tries to get Task B details
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskB.id}`)
        .set('Cookie', cookieUserA)
        .expect(403); // Forbidden

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('access to this task');
    });

    it('should prevent User A from accessing boards in Space B', async () => {
      // User A tries to get Board B columns
      const res = await request(app.getHttpServer())
        .get(`/api/v1/boards/${boardB.id}`)
        .set('Cookie', cookieUserA)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('access to this board');
    });

    it('should prevent User A from getting tasks of Board B', async () => {
      // User A tries to query Board B tasks
      await request(app.getHttpServer())
        .get(`/api/v1/boards/${boardB.id}/tasks`)
        .set('Cookie', cookieUserA)
        .expect(403);
    });

    it('should prevent User A from creating tasks on Board B', async () => {
      // User A tries to create task inside Space B / Board B
      const taskData = {
        title: 'Hacked Task',
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

    it('should prevent User A from archiving tasks in Space B', async () => {
      // User A tries to delete Task B
      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${taskB.id}`)
        .set('Cookie', cookieUserA)
        .expect(403);

      // Verify task B is NOT archived in DB
      const dbTaskB = await prisma.task.findUnique({ where: { id: taskB.id } });
      expect(dbTaskB?.isArchived).toBe(false);
    });
  });
});
