import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { SearchService } from '../src/modules/search/search.service';
import { WorkflowService } from '../src/modules/workflow/workflow.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { performance } from 'perf_hooks';

describe('Performance SLOs Latency Benchmarks (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let searchService: SearchService;
  let workflowService: WorkflowService;
  let notificationsService: NotificationsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    searchService = app.get(SearchService);
    workflowService = app.get(WorkflowService);
    notificationsService = app.get(NotificationsService);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await app.close();
  }, 60000);

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('Task Search SLO (< 500 ms on 10,000 tasks)', () => {
    it('should complete task search under 500ms with 10,000 tasks in DB', async () => {
      // 1. Setup Board and Column
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const dept = await factories.createDepartment(space.id);
      const board = await factories.createBoard(dept.id);
      const col = await factories.createBoardColumn(board.id);

      // 2. Bulk insert 10,000 tasks to DB using Prisma createMany for performance
      const tasksData = Array.from({ length: 10000 }, (_, i) => ({
        identifier: `${space.prefix}-${i + 1}`,
        title: `Task number ${i + 1} for budget tracking`,
        description: `This is task description ${i + 1} with some text`,
        boardId: board.id,
        columnId: col.id,
        status: 'TODO' as any,
        priority: 'MEDIUM' as any,
        createdById: user.id,
        position: i,
      }));

      await prisma.task.createMany({ data: tasksData });

      // 3. Warm up the FTS index / cache
      await searchService.searchTasks('budget', space.id, { page: 1, limit: 20 });

      // 4. Measure execution time
      const start = performance.now();
      const results = await searchService.searchTasks('budget', space.id, {
        page: 1,
        limit: 20,
      });
      const end = performance.now();
      const duration = end - start;

      console.log(`Task Search latency with 10,000 tasks: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Dashboard Load SLO (< 1,000 ms on 100 boards / 5,000 tasks)', () => {
    it('should query dashboard metrics under 1,000ms', async () => {
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const dept = await factories.createDepartment(space.id);

      // Create 100 boards
      const boardsData = Array.from({ length: 100 }, (_, i) => ({
        id: `board-perf-${i}`,
        name: `Board ${i}`,
        departmentId: dept.id,
        type: 'KANBAN' as any,
      }));
      await prisma.board.createMany({ data: boardsData });

      // Create 5,000 tasks distributed across boards
      const tasksData = Array.from({ length: 5000 }, (_, i) => ({
        identifier: `${space.prefix}-dash-${i + 1}`,
        title: `Dashboard Task ${i}`,
        boardId: `board-perf-${i % 100}`,
        status: 'IN_PROGRESS' as any,
        createdById: user.id,
        position: i,
      }));
      await prisma.task.createMany({ data: tasksData });

      // Measure database load performance for all space tasks/boards
      const start = performance.now();
      const [boardCount, taskCount, activeTasks] = await Promise.all([
        prisma.board.count({ where: { department: { spaceId: space.id } } }),
        prisma.task.count({ where: { board: { department: { spaceId: space.id } } } }),
        prisma.task.findMany({
          where: {
            board: { department: { spaceId: space.id } },
            status: 'IN_PROGRESS',
          },
          take: 50,
        }),
      ]);
      const end = performance.now();
      const duration = end - start;

      console.log(`Dashboard query latency: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(1000);
      expect(boardCount).toBe(100);
      expect(taskCount).toBe(5000);
      expect(activeTasks.length).toBe(50);
    });
  });

  describe('Step Approval SLO (< 250 ms on 50 active workflows)', () => {
    it('should submit approval decision under 250ms', async () => {
      const space = await factories.createSpace();
      const requester = await factories.createUser();
      const approver = await factories.createUser();

      // Create workflow definition
      const definition = await prisma.workflowDefinition.create({
        data: {
          spaceId: space.id,
          name: 'Procurement Approval',
          triggerType: 'MANUAL',
          isActive: true,
          createdBy: requester.id,
        },
      });

      await prisma.workflowStep.create({
        data: {
          definitionId: definition.id,
          order: 0,
          name: 'Manager Review',
          approverType: 'USER',
          approverIds: [approver.id],
        },
      });

      // Seed 50 active workflow instances
      const instancesData = Array.from({ length: 50 }, (_, i) => ({
        id: `inst-perf-${i}`,
        definitionId: definition.id,
        spaceId: space.id,
        entityType: 'BUDGET',
        entityId: `budget-perf-${i}`,
        requesterId: requester.id,
        status: 'IN_PROGRESS',
        currentStep: 0,
      }));
      await prisma.workflowInstance.createMany({ data: instancesData });

      // Measure latency of submitDecision
      const start = performance.now();
      await workflowService.submitDecision('inst-perf-25', approver.id, 'APPROVED');
      const end = performance.now();
      const duration = end - start;

      console.log(`Step approval latency: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(250);

      const updated = await prisma.workflowInstance.findUnique({
        where: { id: 'inst-perf-25' },
      });
      expect(updated!.status).toBe('APPROVED');
    });
  });

  describe('Notification Outbox Fanout SLO (< 5.0 seconds on 1,000 enqueued notifications)', () => {
    it('should enqueue 1,000 notifications under 5.0 seconds', async () => {
      const space = await factories.createSpace();
      const user = await factories.createUser();

      const start = performance.now();
      
      // Enqueue 1,000 notifications
      const promises = Array.from({ length: 1000 }, (_, i) =>
        notificationsService.queueNotification({
          userId: user.id,
          spaceId: space.id,
          type: 'SYSTEM_ALERT',
          channel: 'IN_APP',
          title: `Performance Alert ${i}`,
          body: 'This is a notification body to test performance scaling',
        })
      );
      await Promise.all(promises);

      const end = performance.now();
      const duration = (end - start) / 1000; // in seconds

      console.log(`Enqueued 1,000 notifications in: ${duration.toFixed(2)} seconds`);
      expect(duration).toBeLessThan(5.0);
    });
  });
});
