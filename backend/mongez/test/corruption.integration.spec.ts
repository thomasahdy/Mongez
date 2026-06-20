import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';

describe('Data Corruption & Schema Constraints (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;

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
  });

  describe('Board Cascade Deletions', () => {
    it('should cascade delete columns, tasks, and assignments when a board is deleted', async () => {
      // 1. Setup Board
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const dept = await factories.createDepartment(space.id);
      const board = await factories.createBoard(dept.id);
      const col = await factories.createBoardColumn(board.id);

      // 2. Setup Task & Assignment
      const task = await factories.createTask(board.id, user.id, { columnId: col.id });
      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          userId: user.id,
        },
      });

      // 3. Create a Comment on the task
      await prisma.comment.create({
        data: {
          taskId: task.id,
          authorId: user.id,
          content: 'Important comment',
        },
      });

      // 4. Delete the Board
      await prisma.board.delete({
        where: { id: board.id },
      });

      // 5. Verify Cascades
      const boardCount = await prisma.board.count({ where: { id: board.id } });
      const columnCount = await prisma.boardColumn.count({ where: { boardId: board.id } });
      const taskCount = await prisma.task.count({ where: { id: task.id } });
      const commentCount = await prisma.comment.count({ where: { taskId: task.id } });
      const assignmentCount = await prisma.taskAssignment.count({ where: { taskId: task.id } });

      expect(boardCount).toBe(0);
      expect(columnCount).toBe(0);
      expect(taskCount).toBe(0);
      expect(commentCount).toBe(0);
      expect(assignmentCount).toBe(0);
    });
  });

  describe('User Deletion and Orphaned Activity Logs', () => {
    it('should preserve UserActivity entries (orphaned logs) when user is deleted', async () => {
      // 1. Setup User & Space
      const space = await factories.createSpace();
      const user = await factories.createUser();

      // 2. Log user activity (UserActivity doesn't have a strict FK constraint)
      await prisma.userActivity.create({
        data: {
          userId: user.id,
          spaceId: space.id,
          action: 'CREATE_TASK',
          feature: 'TASK',
        },
      });

      // 3. Log audit log (AuditLog has a strict FK constraint to User)
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'task.created',
          entityType: 'Task',
          entityId: 'some-task-id',
        },
      });

      // 4. Delete the user
      await prisma.user.delete({
        where: { id: user.id },
      });

      // 5. Assert: AuditLog is cascade deleted (due to DB constraint)
      const auditCount = await prisma.auditLog.count({ where: { userId: user.id } });
      expect(auditCount).toBe(0);

      // 6. Assert: UserActivity remains in DB (orphaned but prevents analytics data loss)
      const activityCount = await prisma.userActivity.count({ where: { userId: user.id } });
      expect(activityCount).toBe(1);
    });
  });

  describe('Workflow Definition Schema Constraints', () => {
    it('should block deletion of WorkflowDefinition if it has active instances (foreign key safety)', async () => {
      // 1. Setup
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const definition = await prisma.workflowDefinition.create({
        data: {
          spaceId: space.id,
          name: 'Procurement Approval',
          triggerType: 'MANUAL',
          isActive: true,
          createdBy: user.id,
        },
      });

      // 2. Create in-flight workflow instance
      await prisma.workflowInstance.create({
        data: {
          definitionId: definition.id,
          spaceId: space.id,
          entityType: 'BUDGET',
          entityId: 'budget-101',
          requesterId: user.id,
          status: 'IN_PROGRESS',
        },
      });

      // 3. Attempt to delete definition (should throw foreign key constraint error)
      await expect(
        prisma.workflowDefinition.delete({
          where: { id: definition.id },
        }),
      ).rejects.toThrow();
    });
  });
});
