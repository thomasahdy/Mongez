import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TestFactories } from '../helpers/factories';
import { cleanDatabase } from '../helpers/db-cleaner';
import { getAuthCookie } from '../helpers/auth-helper';
import { createTestApp } from '../helpers/create-test-app';
import { AdminService } from '../../src/modules/admin/admin.service';

describe('Disaster Recovery Loop (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let adminService: AdminService;

  let ownerUser: any;
  let cookieOwner: string[];
  let space: any;
  let board: any;
  let column: any;
  let task: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    factories = new TestFactories(prisma);
    adminService = app.get(AdminService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Setup Owner and Space A
    ownerUser = await factories.createUser({ email: 'owner@mongez.test' });
    cookieOwner = await getAuthCookie(app, 'owner@mongez.test');
    space = await factories.createSpace({ prefix: 'REC' });
    await factories.createMembership(ownerUser.id, space.id, 'OWNER');

    const dept = await factories.createDepartment(space.id, { name: 'Engineering' });
    board = await factories.createBoard(dept.id, { name: 'Sprint Board' });
    column = await factories.createBoardColumn(board.id, { name: 'In Progress', position: 1 });
    task = await factories.createTask(board.id, ownerUser.id, {
      title: 'Disaster Recovery Task',
      columnId: column.id,
    });
  });

  // Recreates all space resources transactionally from exported JSON
  async function restoreSpace(prisma: PrismaService, exportData: any) {
    return prisma.$transaction(async (tx) => {
      // 1. Recreate Space
      await tx.space.create({
        data: {
          id: exportData.space.id,
          name: exportData.space.name,
          description: exportData.space.description,
          icon: exportData.space.icon,
          color: exportData.space.color,
          prefix: exportData.space.prefix,
          createdAt: new Date(exportData.space.createdAt),
          updatedAt: new Date(exportData.space.updatedAt),
        },
      });

      // Recreate space counter
      await tx.spaceCounter.create({
        data: {
          spaceId: exportData.space.id,
          seq: 0,
        },
      });

      // 2. Recreate Departments
      for (const dept of exportData.departments) {
        await tx.department.create({
          data: {
            id: dept.id,
            name: dept.name,
            description: dept.description,
            spaceId: dept.spaceId,
            color: dept.color,
            createdAt: new Date(dept.createdAt),
          },
        });
      }

      // 3. Recreate Boards
      for (const b of exportData.boards) {
        await tx.board.create({
          data: {
            id: b.id,
            name: b.name,
            description: b.description,
            departmentId: b.departmentId,
            type: b.type,
            position: b.position,
            color: b.color,
            icon: b.icon,
            isArchived: b.isArchived,
            createdAt: new Date(b.createdAt),
            updatedAt: new Date(b.updatedAt),
          },
        });

        // Recreate columns
        for (const col of b.columns || []) {
          await tx.boardColumn.create({
            data: {
              id: col.id,
              boardId: col.boardId,
              name: col.name,
              position: col.position,
              color: col.color,
              wipLimit: col.wipLimit,
            },
          });
        }
      }

      // 4. Recreate Tasks
      for (const t of exportData.tasks) {
        await tx.task.create({
          data: {
            id: t.id,
            identifier: t.identifier,
            title: t.title,
            description: t.description,
            boardId: t.boardId,
            columnId: t.columnId,
            status: t.status,
            priority: t.priority,
            type: t.type,
            position: t.position,
            estimatedHours: t.estimatedHours,
            percentDone: t.percentDone,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            startDate: t.startDate ? new Date(t.startDate) : null,
            parentId: t.parentId,
            tags: t.tags,
            isArchived: t.isArchived,
            createdById: t.createdById,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          },
        });
      }

      // 5. Recreate Memberships
      for (const member of exportData.members) {
        // Find or create user
        let user = await tx.user.findUnique({ where: { email: member.email } });
        if (!user) {
          user = await tx.user.create({
            data: {
              id: member.userId,
              email: member.email,
              name: member.name,
              passwordHash: 'mock-hash',
            },
          });
        }

        // Find or create role
        let role = await tx.role.findUnique({ where: { name: 'MEMBER' } });
        if (!role) {
          role = await tx.role.create({
            data: { name: 'MEMBER', description: 'Member role' },
          });
        }

        await tx.membership.create({
          data: {
            userId: user.id,
            spaceId: exportData.space.id,
            roleId: role.id,
          },
        });
      }
    });
  }

  it('should successfully execute the full cycle: Export -> Delete -> Restore -> Verify Integrity', async () => {
    // 1. Generate Export JSON Payload (Simulating export generation output)
    const departments = await prisma.department.findMany({ where: { spaceId: space.id } });
    const boards = await prisma.board.findMany({
      where: { department: { spaceId: space.id } },
      include: { columns: true },
    });
    const tasks = await prisma.task.findMany({
      where: { board: { department: { spaceId: space.id } } },
    });
    const members = await prisma.membership.findMany({
      where: { spaceId: space.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const exportData = {
      space,
      departments,
      boards,
      tasks,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
      })),
    };

    // Verify initial count is correct
    expect(exportData.departments.length).toBe(1);
    expect(exportData.boards.length).toBe(1);
    expect(exportData.tasks.length).toBe(1);

    // 2. Hard Delete Space via Admin API/Service (Simulates disaster/destruction)
    await adminService.deleteSpace(space.id);

    // Verify all related records are completely purged (cascade deleted)
    const dbSpace = await prisma.space.findUnique({ where: { id: space.id } });
    expect(dbSpace).toBeNull();

    const dbDepts = await prisma.department.findMany({ where: { spaceId: space.id } });
    expect(dbDepts.length).toBe(0);

    const dbBoards = await prisma.board.findMany({ where: { department: { spaceId: space.id } } });
    expect(dbBoards.length).toBe(0);

    const dbTasks = await prisma.task.findMany({ where: { board: { department: { spaceId: space.id } } } });
    expect(dbTasks.length).toBe(0);

    // 3. Restore Space from Export Data (Import)
    await restoreSpace(prisma, exportData);

    // 4. Verify Data Integrity
    const restoredSpace = await prisma.space.findUnique({ where: { id: space.id } });
    expect(restoredSpace).not.toBeNull();
    expect(restoredSpace?.name).toBe(space.name);

    const restoredDepts = await prisma.department.findMany({ where: { spaceId: space.id } });
    expect(restoredDepts.length).toBe(1);
    expect(restoredDepts[0].name).toBe('Engineering');

    const restoredBoards = await prisma.board.findMany({
      where: { department: { spaceId: space.id } },
      include: { columns: true },
    });
    expect(restoredBoards.length).toBe(1);
    expect(restoredBoards[0].name).toBe('Sprint Board');
    expect(restoredBoards[0].columns.length).toBe(1);
    expect(restoredBoards[0].columns[0].name).toBe('In Progress');

    const restoredTasks = await prisma.task.findMany({
      where: { board: { department: { spaceId: space.id } } },
    });
    expect(restoredTasks.length).toBe(1);
    expect(restoredTasks[0].title).toBe('Disaster Recovery Task');
    expect(restoredTasks[0].identifier).toBe(task.identifier);
  });
});
