import { TaskAccessGuard } from './task-access.guard';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ExecutionContext } from '@nestjs/common';

describe('TaskAccessGuard', () => {
  let guard: TaskAccessGuard;
  let prisma: jest.Mocked<PrismaService>;

  const buildContext = (request: Partial<any>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    } as any);

  beforeEach(() => {
    prisma = {
      task: { findUnique: jest.fn() },
      membership: { findFirst: jest.fn() },
    } as any;

    guard = new TaskAccessGuard(prisma);
  });

  it('UT-GRD-004: should return false when no userId is present on request', async () => {
    const ctx = buildContext({ user: null, params: { id: 'task-1' } });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(false);
  });

  it('should return true when no taskId is provided in params (non-task routes)', async () => {
    const ctx = buildContext({ user: { userId: 'user-1' }, params: {} });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(prisma.task.findUnique).not.toHaveBeenCalled();
  });

  it('UT-GRD-005: should throw NotFoundException when task does not exist', async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);
    const ctx = buildContext({ user: { userId: 'user-1' }, params: { id: 'non-existent' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Task not found');
  });

  it('UT-GRD-006: should throw ForbiddenException when user is not a member of the task space', async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      board: { department: { spaceId: 'space-1' } },
    });
    (prisma.membership.findFirst as jest.Mock).mockResolvedValue(null);

    const ctx = buildContext({ user: { userId: 'user-not-member' }, params: { id: 'task-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('You do not have access to this task');
  });

  it('UT-GRD-007: should allow access and attach taskSpaceId to request for space members', async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      board: { department: { spaceId: 'space-1' } },
    });
    (prisma.membership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });

    const request: any = { user: { userId: 'user-1' }, params: { id: 'task-1' } };
    const ctx = buildContext(request);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.taskSpaceId).toBe('space-1');
  });

  it('should also accept taskId from params.taskId field', async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      board: { department: { spaceId: 'space-1' } },
    });
    (prisma.membership.findFirst as jest.Mock).mockResolvedValue({ id: 'membership-1' });

    const request: any = { user: { userId: 'user-1' }, params: { taskId: 'task-from-nested-route' } };
    const ctx = buildContext(request);

    const result = await guard.canActivate(ctx);

    expect(prisma.task.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'task-from-nested-route' } }),
    );
    expect(result).toBe(true);
  });
});
