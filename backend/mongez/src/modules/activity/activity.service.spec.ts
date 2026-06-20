import { ActivityService } from './activity.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new ActivityService(prisma as PrismaService);
  });

  describe('createActivity()', () => {
    it('UT-ACTIVITY-CREATE-001: should create activity in database', async () => {
      const mockResult = { id: 'act-1' };
      prisma.activity.create.mockResolvedValue(mockResult);

      const result = await service.createActivity('user-1', 'task-1', 'TASK_MOVED', { from: 'TODO', to: 'IN_PROGRESS' });

      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          taskId: 'task-1',
          type: 'TASK_MOVED',
          data: { from: 'TODO', to: 'IN_PROGRESS' },
        },
      });
      expect(result).toEqual(mockResult);
    });

    it('UT-ACTIVITY-CREATE-002: should log error but not throw when database insertion fails', async () => {
      prisma.activity.create.mockRejectedValue(new Error('Prisma disconnect'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.createActivity('user-1', 'task-1', 'TASK_MOVED', {})).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to write activity:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getSpaceActivity()', () => {
    it('UT-ACTIVITY-SPACE-001: should query activities matching spaceId criteria with pagination', async () => {
      prisma.activity.findMany.mockResolvedValue([{ id: 'act-1' }]);

      const result = await service.getSpaceActivity('space-1', 2, 20);

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { task: { board: { department: { spaceId: 'space-1' } } } },
            { data: { path: ['spaceId'], equals: 'space-1' } },
          ],
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          task: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: 20, // (2 - 1) * 20
        take: 20,
      });
      expect(result).toEqual([{ id: 'act-1' }]);
    });
  });

  describe('getBoardActivity()', () => {
    it('UT-ACTIVITY-BOARD-001: should query activities matching boardId criteria', async () => {
      prisma.activity.findMany.mockResolvedValue([{ id: 'act-2' }]);

      const result = await service.getBoardActivity('board-1', 1, 50);

      expect(prisma.activity.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { task: { boardId: 'board-1' } },
            { data: { path: ['boardId'], equals: 'board-1' } },
          ],
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          task: { select: { id: true, identifier: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
      expect(result).toEqual([{ id: 'act-2' }]);
    });
  });
});
