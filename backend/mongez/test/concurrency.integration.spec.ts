import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { WorkflowService } from '../src/modules/workflow/workflow.service';
import { TasksService } from '../src/modules/tasks/tasks.service';
import { DelegationService } from '../src/modules/delegation/delegation.service';
import { OutboxRelayService } from '../src/modules/notifications/outbox/outbox-relay.service';
import { OutboxRepository } from '../src/modules/notifications/outbox/outbox.repository';

describe('Concurrency & Race Conditions (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let workflowService: WorkflowService;
  let tasksService: TasksService;
  let delegationService: DelegationService;
  let outboxRelayService: OutboxRelayService;
  let outboxRepository: OutboxRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    workflowService = app.get(WorkflowService);
    tasksService = app.get(TasksService);
    delegationService = app.get(DelegationService);
    outboxRelayService = app.get(OutboxRelayService);
    outboxRepository = app.get(OutboxRepository);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('Concurrent Step Approvals', () => {
    it('should handle concurrent step approvals in a parallel step requiresAll=true correctly', async () => {
      // 1. Setup space & users
      const space = await factories.createSpace();
      const requester = await factories.createUser();
      const approverA = await factories.createUser();
      const approverB = await factories.createUser();

      // 2. Setup workflow definition with a parallel step requiring both users
      const definition = await prisma.workflowDefinition.create({
        data: {
          spaceId: space.id,
          name: 'Parallel Procurement',
          triggerType: 'MANUAL',
          isActive: true,
          createdBy: requester.id,
        },
      });

      await prisma.workflowStep.create({
        data: {
          definitionId: definition.id,
          order: 0,
          name: 'Double Sign',
          approverType: 'USER',
          approverIds: [approverA.id, approverB.id],
          isParallel: true,
          requiresAll: true,
        },
      });

      // 3. Start workflow instance
      const instance = await workflowService.startWorkflow(requester.id, {
        definitionId: definition.id,
        spaceId: space.id,
        entityType: 'BUDGET',
        entityId: 'procure-1',
      });

      // 4. Submit approvals concurrently (using Promise.all)
      await Promise.all([
        workflowService.submitDecision(instance!.id, approverA.id, 'APPROVED'),
        workflowService.submitDecision(instance!.id, approverB.id, 'APPROVED'),
      ]);

      // 5. Verify both decisions are saved and workflow is APPROVED
      const actions = await prisma.workflowAction.findMany({
        where: { instanceId: instance!.id },
      });
      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.actorId)).toContain(approverA.id);
      expect(actions.map((a) => a.actorId)).toContain(approverB.id);

      const finalInstance = await prisma.workflowInstance.findUnique({
        where: { id: instance!.id },
      });
      expect(finalInstance!.status).toBe('APPROVED');
    });
  });

  describe('Concurrent Kanban Moves', () => {
    it('should reorder positions cleanly without deadlocks or duplication', async () => {
      // 1. Setup Board and Column
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const dept = await factories.createDepartment(space.id);
      const board = await factories.createBoard(dept.id);
      const col = await factories.createBoardColumn(board.id);

      // 2. Create 3 tasks in that column (default positions will be 0, 1, 2)
      const task1 = await factories.createTask(board.id, user.id, { columnId: col.id, identifier: 'T-1' });
      const task2 = await factories.createTask(board.id, user.id, { columnId: col.id, identifier: 'T-2' });
      const task3 = await factories.createTask(board.id, user.id, { columnId: col.id, identifier: 'T-3' });

      // 3. Concurrently move task2 to position 0 and task3 to position 0
      // This tests the database transaction lock safety under position incrementing.
      await Promise.all([
        tasksService.moveTask(task2.id, { columnId: col.id, position: 0 }, user.id),
        tasksService.moveTask(task3.id, { columnId: col.id, position: 0 }, user.id),
      ]);

      // 4. Retrieve tasks and verify position sequence contains no duplicates
      const tasks = await prisma.task.findMany({
        where: { columnId: col.id },
        orderBy: { position: 'asc' },
      });

      const positions = tasks.map((t) => t.position);
      // Expected positions: [0, 1, 2] or similar unique sequence, no duplicates
      const uniquePositions = Array.from(new Set(positions));
      expect(uniquePositions.length).toBe(3);
      expect(positions).toEqual([0, 1, 2]);
    });
  });

  describe('In-Flight Delegation Revocation', () => {
    it('should block delegate approval if delegation is deactivated mid-flight', async () => {
      const space = await factories.createSpace();
      const requester = await factories.createUser();
      const approver = await factories.createUser();
      const delegate = await factories.createUser();

      // Ensure delegate is member of the space
      await factories.createMembership(delegate.id, space.id);

      // Create workflow definition
      const definition = await prisma.workflowDefinition.create({
        data: {
          spaceId: space.id,
          name: 'Delegated Approval Flow',
          triggerType: 'MANUAL',
          isActive: true,
          createdBy: requester.id,
        },
      });

      await prisma.workflowStep.create({
        data: {
          definitionId: definition.id,
          order: 0,
          name: 'Review',
          approverType: 'USER',
          approverIds: [approver.id],
          isParallel: false,
        },
      });

      // Start workflow instance
      const instance = await workflowService.startWorkflow(requester.id, {
        definitionId: definition.id,
        spaceId: space.id,
        entityType: 'BUDGET',
        entityId: 'budget-delegated',
      });

      // Create active delegation from approver to delegate
      const delegation = await delegationService.createDelegation(
        approver.id,
        space.id,
        delegate.id,
        new Date(Date.now() - 10000).toISOString(),
        new Date(Date.now() + 10000).toISOString(),
      );

      // Revoke/deactivate delegation
      await delegationService.deactivateDelegation(delegation.id, approver.id);

      // Try to approve using the delegate's ID (should fail since it's revoked)
      await expect(
        workflowService.submitDecision(instance!.id, delegate.id, 'APPROVED'),
      ).rejects.toThrow();
    });
  });

  describe('Outbox Relay Mutex Lock', () => {
    it('should serialize/lock outbox relay and prevent concurrent execution', async () => {
      // Spy on outbox repository fetch method
      const spyGetEvents = jest.spyOn(outboxRepository, 'getUnprocessedEvents');

      // Call handleOutboxRelay concurrently
      await Promise.all([
        outboxRelayService.handleOutboxRelay(),
        outboxRelayService.handleOutboxRelay(),
      ]);

      // The isProcessing mutex flag should have blocked the second call from executing repository queries
      expect(spyGetEvents).toHaveBeenCalledTimes(1);
    });
  });
});
