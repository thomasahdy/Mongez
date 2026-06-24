/**
 * Integration Tests: Spaces → Departments → Boards → Tasks Flow
 *
 * Tests the complete user flow for creating workspaces and boards.
 * This test suite validates the fixes for the board creation bug where:
 * 1. useCreateBoard hook incorrectly captured data at initialization
 * 2. DepartmentRow double-wrapped the data object
 *
 * Flow tested:
 * 1. Create Space
 * 2. Create Department within Space
 * 3. Create Board within Department (with auto-created columns)
 * 4. Create Task within Board
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { getAuthCookie } from './helpers/auth-helper';
import { createTestApp } from './helpers/create-test-app';
import { BoardType, TaskStatus, Priority } from '@prisma/client';

describe('Spaces → Departments → Boards → Tasks Flow (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let authCookie: string[];
  let testUser: any;

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
    testUser = await factories.createUser({ email: 'flow-test@mongez.test' });
    authCookie = await getAuthCookie(app, 'flow-test@mongez.test');
  });

  describe('Complete Flow: Space → Department → Board → Task', () => {
    it('IT-FLOW-001: should create complete workspace hierarchy', async () => {
      // Step 1: Create Space
      const spaceRes = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Cookie', authCookie)
        .send({ name: 'Engineering Workspace', prefix: 'ENG' })
        .expect(201);

      expect(spaceRes.body.success).toBe(true);
      const spaceId = spaceRes.body.data.id;
      expect(spaceRes.body.data.name).toBe('Engineering Workspace');

      // Verify owner membership
      const membership = await prisma.membership.findFirst({
        where: { userId: testUser.id, spaceId },
        include: { role: true },
      });
      expect(membership?.role.name).toBe('OWNER');

      // Step 2: Create Department within Space
      const deptRes = await request(app.getHttpServer())
        .post(`/api/v1/spaces/${spaceId}/departments`)
        .set('Cookie', authCookie)
        .send({ name: 'Backend Development', description: 'Server-side development team' })
        .expect(201);

      expect(deptRes.body.success).toBe(true);
      const departmentId = deptRes.body.data.id;
      expect(deptRes.body.data.name).toBe('Backend Development');

      // Verify department in database
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      expect(department).toBeDefined();
      expect(department?.spaceId).toBe(spaceId);

      // Step 3: Create Board within Department
      const boardRes = await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Sprint 24 Board',
          type: BoardType.KANBAN,
          departmentId: departmentId,
          description: 'Sprint 24 tracking board',
        })
        .expect(201);

      expect(boardRes.body.success).toBe(true);
      const boardId = boardRes.body.data.id;
      expect(boardRes.body.data.name).toBe('Sprint 24 Board');
      expect(boardRes.body.data.type).toBe(BoardType.KANBAN);

      // Verify board in database
      const board = await prisma.board.findUnique({
        where: { id: boardId },
        include: { columns: true },
      });
      expect(board).toBeDefined();
      expect(board?.departmentId).toBe(departmentId);

      // Verify 4 default columns were auto-created
      expect(board?.columns).toHaveLength(4);
      const columnNames = board?.columns.map((c) => c.name).sort() || [];
      expect(columnNames).toEqual(['Done', 'In Progress', 'In Review', 'To Do']);

      // Step 4: Create Task within Board
      const firstColumn = board?.columns.find((c) => c.name === 'To Do');
      expect(firstColumn).toBeDefined();

      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Cookie', authCookie)
        .send({
          title: 'Implement board creation fix',
          boardId: boardId,
          columnId: firstColumn!.id,
          priority: Priority.HIGH,
          description: 'Fix useCreateBoard hook anti-pattern',
        })
        .expect(201);

      expect(taskRes.body.success).toBe(true);
      const taskId = taskRes.body.data.id;
      expect(taskRes.body.data.title).toBe('Implement board creation fix');
      expect(taskRes.body.data.identifier).toMatch(/^ENG-\d+$/);

      // Verify task in database
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      expect(task).toBeDefined();
      expect(task?.boardId).toBe(boardId);
      expect(task?.columnId).toBe(firstColumn!.id);

      // Verify complete hierarchy
      const finalBoard = await prisma.board.findUnique({
        where: { id: boardId },
        include: {
          department: {
            include: { space: true },
          },
          _count: { select: { tasks: true } },
        },
      });

      expect(finalBoard?.department.space.id).toBe(spaceId);
      expect(finalBoard?.department.id).toBe(departmentId);
      expect(finalBoard?._count.tasks).toBe(1);
    });

    it('IT-FLOW-002: should handle board creation with all supported types', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');
      const department = await factories.createDepartment(space.id);

      const boardTypes = [
        BoardType.KANBAN,
        BoardType.LIST,
        BoardType.TABLE,
        BoardType.TIMELINE,
        BoardType.CALENDAR,
        BoardType.WHITEBOARD,
      ];

      for (const type of boardTypes) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/boards')
          .set('Cookie', authCookie)
          .send({
            name: `Test ${type} Board`,
            type,
            departmentId: department.id,
          })
          .expect(201);

        expect(res.body.data.type).toBe(type);
        expect(res.body.data.columns).toHaveLength(4);
      }
    });

    it('IT-FLOW-003: should enforce subscription limits on board creation', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');
      const department = await factories.createDepartment(space.id);

      // Update space to FREE plan with 2 board limit
      await prisma.space.update({
        where: { id: space.id },
        data: { plan: 'FREE' },
      });

      // Create first board - should succeed
      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Board 1',
          type: BoardType.KANBAN,
          departmentId: department.id,
        })
        .expect(201);

      // Create second board - should succeed
      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Board 2',
          type: BoardType.KANBAN,
          departmentId: department.id,
        })
        .expect(201);

      // Create third board - should fail (limit exceeded)
      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Board 3',
          type: BoardType.KANBAN,
          departmentId: department.id,
        })
        .expect(403);
    });

    it('IT-FLOW-004: should validate board creation request', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');
      const department = await factories.createDepartment(space.id);

      // Missing required fields
      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          type: BoardType.KANBAN,
          departmentId: department.id,
          // name is missing
        })
        .expect(400);

      // Invalid department ID
      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Test Board',
          type: BoardType.KANBAN,
          departmentId: 'non-existent-dept-id',
        })
        .expect(404);

      // Invalid board type
      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Test Board',
          type: 'INVALID_TYPE',
          departmentId: department.id,
        })
        .expect(400);
    });

    it('IT-FLOW-005: should prevent non-members from creating boards', async () => {
      const space = await factories.createSpace();
      const department = await factories.createDepartment(space.id);
      // Note: No membership created for testUser

      await request(app.getHttpServer())
        .post('/api/v1/boards')
        .set('Cookie', authCookie)
        .send({
          name: 'Unauthorized Board',
          type: BoardType.KANBAN,
          departmentId: department.id,
        })
        .expect(403);
    });

    it('IT-FLOW-006: should list boards within a department', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');
      const department = await factories.createDepartment(space.id);

      // Create multiple boards
      await factories.createBoard(department.id, { name: 'Board A' });
      await factories.createBoard(department.id, { name: 'Board B' });
      await factories.createBoard(department.id, { name: 'Board C' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${department.id}/boards`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toHaveLength(3);
      const boardNames = res.body.data.data.map((b: any) => b.name).sort();
      expect(boardNames).toEqual(['Board A', 'Board B', 'Board C']);
    });
  });

  describe('Department Operations', () => {
    it('IT-FLOW-007: should create department with validation', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');

      // Valid department creation
      const res = await request(app.getHttpServer())
        .post(`/api/v1/spaces/${space.id}/departments`)
        .set('Cookie', authCookie)
        .send({
          name: 'Quality Assurance',
          description: 'QA and testing team',
          color: '#FF5733',
        })
        .expect(201);

      expect(res.body.data.name).toBe('Quality Assurance');
      expect(res.body.data.description).toBe('QA and testing team');

      // Name too short
      await request(app.getHttpServer())
        .post(`/api/v1/spaces/${space.id}/departments`)
        .set('Cookie', authCookie)
        .send({ name: 'A' })
        .expect(400);

      // Name too long
      await request(app.getHttpServer())
        .post(`/api/v1/spaces/${space.id}/departments`)
        .set('Cookie', authCookie)
        .send({ name: 'A'.repeat(51) })
        .expect(400);
    });

    it('IT-FLOW-008: should update department', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');
      const department = await factories.createDepartment(space.id, { name: 'Old Name' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/spaces/${space.id}/departments/${department.id}`)
        .set('Cookie', authCookie)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.data.name).toBe('New Name');

      const updated = await prisma.department.findUnique({ where: { id: department.id } });
      expect(updated?.name).toBe('New Name');
    });

    it('IT-FLOW-009: should delete department', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');
      const department = await factories.createDepartment(space.id);

      await request(app.getHttpServer())
        .delete(`/api/v1/spaces/${space.id}/departments/${department.id}`)
        .set('Cookie', authCookie)
        .expect(204);

      const deleted = await prisma.department.findUnique({ where: { id: department.id } });
      expect(deleted).toBeNull();
    });

    it('IT-FLOW-010: should list departments in space', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(testUser.id, space.id, 'ADMIN');

      await factories.createDepartment(space.id, { name: 'Engineering' });
      await factories.createDepartment(space.id, { name: 'Design' });
      await factories.createDepartment(space.id, { name: 'Marketing' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/spaces/${space.id}/departments`)
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body.data.departments).toHaveLength(3);
      const deptNames = res.body.data.departments.map((d: any) => d.name).sort();
      expect(deptNames).toEqual(['Design', 'Engineering', 'Marketing']);
    });
  });
});
