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

describe('Permissions Guard & Decorator (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;

  let space: any;
  let board: any;
  let column: any;
  let task: any;

  // Test users & cookies
  let viewerUser: any;
  let memberUser: any;
  let adminUser: any;

  let cookieViewer: string[];
  let cookieMember: string[];
  let cookieAdmin: string[];

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

    // Create space & structure
    space = await factories.createSpace({ prefix: 'SEC' });
    const dept = await factories.createDepartment(space.id);
    board = await factories.createBoard(dept.id);
    column = await factories.createBoardColumn(board.id);

    // Create a task that belongs to the space for GET tasks tests
    const ownerUser = await factories.createUser({ email: 'owner@mongez.test' });
    await factories.createMembership(ownerUser.id, space.id, 'OWNER');
    task = await factories.createTask(board.id, ownerUser.id, {
      title: 'Base Task',
      columnId: column.id,
    });

    // Create Viewer
    viewerUser = await factories.createUser({ email: 'viewer@mongez.test' });
    cookieViewer = await getAuthCookie(app, 'viewer@mongez.test');
    await factories.createMembership(viewerUser.id, space.id, 'VIEWER');

    // Create Member
    memberUser = await factories.createUser({ email: 'member@mongez.test' });
    cookieMember = await getAuthCookie(app, 'member@mongez.test');
    await factories.createMembership(memberUser.id, space.id, 'MEMBER');

    // Create Admin
    adminUser = await factories.createUser({ email: 'admin@mongez.test' });
    cookieAdmin = await getAuthCookie(app, 'admin@mongez.test');
    await factories.createMembership(adminUser.id, space.id, 'ADMIN');
  });

  describe('Viewer Permissions Matrix', () => {
    it('should prevent Viewer from creating a task (403)', async () => {
      const taskData = {
        title: 'Viewer Task Attempt',
        boardId: board.id,
        columnId: column.id,
        spaceId: space.id,
        spacePrefix: space.prefix,
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
      };

      await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Cookie', cookieViewer)
        .send(taskData)
        .expect(403);
    });

    it('should allow Viewer to read a task (200)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/tasks/${task.id}`)
        .set('Cookie', cookieViewer)
        .expect(200);
    });
  });

  describe('Member Permissions Matrix', () => {
    it('should allow Member to create a task (201)', async () => {
      const taskData = {
        title: 'Member Task Success',
        boardId: board.id,
        columnId: column.id,
        spaceId: space.id,
        spacePrefix: space.prefix,
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Cookie', cookieMember)
        .send(taskData)
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('should prevent Member from deleting a board (403)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/boards/${board.id}`)
        .set('Cookie', cookieMember)
        .expect(403);

      // Verify board is not archived
      const dbBoard = await prisma.board.findUnique({ where: { id: board.id } });
      expect(dbBoard?.isArchived).toBe(false);
    });
  });

  describe('Admin Permissions Matrix', () => {
    it('should allow Admin to delete (archive) a board (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/boards/${board.id}`)
        .set('Cookie', cookieAdmin)
        .expect(204);

      // Verify board is archived
      const dbBoard = await prisma.board.findUnique({ where: { id: board.id } });
      expect(dbBoard?.isArchived).toBe(true);
    });
  });
});
