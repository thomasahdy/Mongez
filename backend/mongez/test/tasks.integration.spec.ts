import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { getAuthCookie } from './helpers/auth-helper';
import { createTestApp } from './helpers/create-test-app';
import { TaskStatus, Priority } from '@prisma/client';

describe('TasksController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let authCookie: string[];
  let testUser: any;
  let space: any;
  let board: any;
  let column: any;

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

    // Setup basic workspace hierarchy for testing tasks
    testUser = await factories.createUser({ email: 'tasks-user@mongez.test' });
    authCookie = await getAuthCookie(app, 'tasks-user@mongez.test');

    space = await factories.createSpace({ prefix: 'PRJ' });
    await factories.createMembership(testUser.id, space.id);

    const department = await factories.createDepartment(space.id);
    board = await factories.createBoard(department.id);
    column = await factories.createBoardColumn(board.id);
  });

  describe('POST /api/v1/tasks', () => {
    it('IT-API-TASK-009: should create a task successfully', async () => {
      const taskData = {
        title: 'Integration Test Task',
        boardId: board.id,
        columnId: column.id,
        spaceId: space.id,
        spacePrefix: space.prefix,
        status: TaskStatus.TODO,
        priority: Priority.HIGH,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Cookie', authCookie)
        .send(taskData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(taskData.title);
      expect(res.body.data.identifier).toBe('PRJ-1'); // Space Counter starts at 0, increments to 1

      // Verify db state
      const task = await prisma.task.findUnique({ where: { id: res.body.data.id } });
      expect(task).toBeDefined();
      expect(task?.title).toBe(taskData.title);
    });

    it('should return 400 Bad Request if validation fails (e.g. missing title)', async () => {
      const invalidData = {
        // missing required fields: title, boardId, columnId, spaceId, spacePrefix
        description: 'A task without required fields',
      };

      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Cookie', authCookie)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /api/v1/boards/:boardId/tasks', () => {
    it('IT-API-TASK-003: should return tasks for a specific board', async () => {
      await factories.createTask(board.id, testUser.id, { title: 'Task 1', columnId: column.id });
      await factories.createTask(board.id, testUser.id, { title: 'Task 2', columnId: column.id });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/boards/${board.id}/tasks`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      // paginate() returns { data: T[], meta: { page, limit, total, totalPages } }
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.meta.total).toBe(2);
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('IT-API-TASK-001: should return task details', async () => {
      const task = await factories.createTask(board.id, testUser.id, { title: 'Find Me', columnId: column.id });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(task.id);
      expect(res.body.data.title).toBe('Find Me');
    });

    it('IT-API-TASK-002: should return 404 if task is not found', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/tasks/non-existent-id')
        .set('Cookie', authCookie)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('IT-API-TASK-011: should update task details', async () => {
      const task = await factories.createTask(board.id, testUser.id, { title: 'Original Title', columnId: column.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .send({ title: 'Updated Title', priority: Priority.URGENT })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.priority).toBe(Priority.URGENT);

      // Verify db state
      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(dbTask?.title).toBe('Updated Title');
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('IT-API-TASK-013: should archive task successfully', async () => {
      const task = await factories.createTask(board.id, testUser.id, { title: 'Archive Me', columnId: column.id });

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .expect(204);

      // Verify task is archived in db
      const dbTask = await prisma.task.findUnique({ where: { id: task.id } });
      expect(dbTask?.isArchived).toBe(true);
    });
  });
});
