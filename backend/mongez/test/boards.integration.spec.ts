import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { getAuthCookie } from './helpers/auth-helper';
import { createTestApp } from './helpers/create-test-app';
import { BoardType } from '@prisma/client';

describe('BoardsController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let authCookie: string[];
  let testUser: any;
  let space: any;
  let department: any;

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

    testUser = await factories.createUser({ email: 'boards-user@mongez.test' });
    authCookie = await getAuthCookie(app, 'boards-user@mongez.test');

    space = await factories.createSpace();
    await factories.createMembership(testUser.id, space.id, 'ADMIN');

    department = await factories.createDepartment(space.id);
  });

  describe('POST /api/v1/boards', () => {
    it('IT-API-BOARD-003: should create a board successfully', async () => {
      const boardData = {
        name: 'Sprint Kanban Board',
        type: BoardType.KANBAN,
        departmentId: department.id,
        description: 'Sprint board for testing',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send(boardData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe(boardData.name);

      // Verify db insertion
      const board = await prisma.board.findUnique({ where: { id: res.body.data.id } });
      expect(board).toBeDefined();
      expect(board?.name).toBe(boardData.name);
    });
  });

  describe('GET /api/v1/boards/:id', () => {
    it('IT-API-BOARD-001: should return board with columns', async () => {
      const board = await factories.createBoard(department.id, { name: 'Board to Fetch' });
      const column = await factories.createBoardColumn(board.id, { name: 'To Do', position: 1 });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/boards/${board.id}`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(board.id);
      expect(res.body.data.columns).toBeDefined();
      expect(res.body.data.columns[0].name).toBe('To Do');
    });

    it('should return 404 for non-existent board', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/boards/non-existent-board-id')
        .set('Cookie', authCookie)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/boards/:id', () => {
    it('IT-API-BOARD-004: should update board details', async () => {
      const board = await factories.createBoard(department.id, { name: 'Old Board Name' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/boards/${board.id}`)
        .set('Cookie', authCookie)
        .send({ name: 'New Board Name', type: BoardType.TABLE })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Board Name');
      expect(res.body.data.type).toBe(BoardType.TABLE);
    });
  });

  describe('DELETE /api/v1/boards/:id', () => {
    it('IT-API-BOARD-005: should archive board', async () => {
      const board = await factories.createBoard(department.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/boards/${board.id}`)
        .set('Cookie', authCookie)
        .expect(204);

      const dbBoard = await prisma.board.findUnique({ where: { id: board.id } });
      expect(dbBoard?.isArchived).toBe(true);
    });
  });

  describe('POST /api/v1/boards/:id/columns', () => {
    it('should add a column to a board', async () => {
      const board = await factories.createBoard(department.id);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/boards/${board.id}/columns`)
        .set('Cookie', authCookie)
        .send({ name: 'New Column', position: 2 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Column');

      const col = await prisma.boardColumn.findUnique({ where: { id: res.body.data.id } });
      expect(col).toBeDefined();
    });
  });
});
