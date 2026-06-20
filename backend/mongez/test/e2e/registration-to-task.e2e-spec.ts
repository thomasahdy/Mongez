import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { cleanDatabase } from '../helpers/db-cleaner';
import { createTestApp } from '../helpers/create-test-app';

describe('Registration-to-Task E2E Journey', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  it('should complete registration, onboarding setup, and task CRUD lifecycle', async () => {
    // 1. Register a user
    const registerPayload = {
      email: 'e2e.tasker@mongez.test',
      password: 'Password123!',
      name: 'E2E Tasker',
    };

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(registerPayload)
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    const token = registerRes.body.data.accessToken;
    expect(token).toBeDefined();

    // 2. Fetch templates
    const templatesRes = await request(app.getHttpServer())
      .get('/api/v1/onboarding/templates')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(templatesRes.body.success).toBe(true);
    const templates = templatesRes.body.data;
    expect(templates.length).toBeGreaterThan(0);
    const templateId = templates[0].id;

    // 3. Complete onboarding space setup
    const onboardingPayload = {
      name: 'E2E Tasker Space',
      description: 'A workspace created in E2E tests',
      icon: '🚀',
      color: '#1a73e8',
      prefix: 'TKR',
      templateId,
    };

    const onboardingRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/setup')
      .set('Authorization', `Bearer ${token}`)
      .send(onboardingPayload)
      .expect(201);

    expect(onboardingRes.body.success).toBe(true);
    const space = onboardingRes.body.data;
    expect(space.name).toBe(onboardingPayload.name);
    
    // Retrieve first board and column
    const board = space.departments[0].boards[0];
    const column = board.columns[0];
    expect(board).toBeDefined();
    expect(column).toBeDefined();

    // 4. Create a task via API
    const createTaskPayload = {
      title: 'Task Created in E2E Test',
      description: 'E2E description content',
      boardId: board.id,
      columnId: column.id,
      spaceId: space.id,
      spacePrefix: space.prefix,
    };

    const createTaskRes = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send(createTaskPayload)
      .expect(201);

    expect(createTaskRes.body.success).toBe(true);
    const task = createTaskRes.body.data;
    expect(task.title).toBe(createTaskPayload.title);
    expect(task.identifier).toContain('TKR-');

    // 5. Update/move task via API
    const updateTaskPayload = {
      status: 'IN_PROGRESS',
    };

    const updateTaskRes = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updateTaskPayload)
      .expect(200);

    expect(updateTaskRes.body.success).toBe(true);
    expect(updateTaskRes.body.data.status).toBe('IN_PROGRESS');

    // 6. Fetch task via API
    const fetchTaskRes = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fetchTaskRes.body.success).toBe(true);
    expect(fetchTaskRes.body.data.status).toBe('IN_PROGRESS');

    // 7. Get board tasks
    const boardTasksRes = await request(app.getHttpServer())
      .get(`/api/v1/boards/${board.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(boardTasksRes.body.success).toBe(true);
    const boardTasks = boardTasksRes.body.data.data;
    expect(boardTasks.some((t: any) => t.id === task.id)).toBe(true);

    // 8. Archive/Soft-delete task via API
    await request(app.getHttpServer())
      .delete(`/api/v1/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('should reject register with weak password and handle lockout', async () => {
    // 1. Weak password registration should fail
    const weakRegisterPayload = {
      email: 'weak.user@mongez.test',
      password: '123',
      name: 'Weak User',
    };

    const weakRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(weakRegisterPayload)
      .expect(400);

    expect(weakRes.body.success).toBe(false);

    // 2. Failed logins should trigger brute force lockout
    const userPayload = {
      email: 'lockout.user@mongez.test',
      password: 'Password123!',
      name: 'Lockout User',
    };

    // Register user first
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userPayload)
      .expect(201);

    // Attempt 5 incorrect logins to trigger lockout
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: userPayload.email, password: 'wrongpassword' })
        .expect(401);
    }

    // 6th attempt should return 403 Forbidden due to lockout
    const lockRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: userPayload.email, password: 'wrongpassword' })
      .expect(403);

    expect(lockRes.body.message).toContain('locked');
  });
});
