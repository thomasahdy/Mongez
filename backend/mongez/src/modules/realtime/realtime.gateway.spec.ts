import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { JwtService } from '../auth/services/jwt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RealtimeService } from './realtime.service';
import { CacheService } from '../../infrastructure/cache/cache.service';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: jest.Mocked<PrismaService>;
  let realtimeService: jest.Mocked<RealtimeService>;
  let cacheService: jest.Mocked<CacheService>;

  let mockSocket: any;
  let mockServer: any;

  beforeEach(async () => {
    jwtService = {
      verifyAccessToken: jest.fn(),
    } as any;

    prisma = {
      membership: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      board: {
        findUnique: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
      taskView: {
        upsert: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    } as any;

    realtimeService = {
      setServer: jest.fn(),
      emitToBoard: jest.fn(),
      emitToSpace: jest.fn(),
      emitToUser: jest.fn(),
    } as any;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      zadd: jest.fn(),
      zrem: jest.fn(),
      zremrangebyscore: jest.fn(),
      zrange: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: RealtimeService, useValue: realtimeService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);

    mockServer = {
      in: jest.fn().mockReturnThis(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([]),
    };
    gateway.server = mockServer;

    mockSocket = {
      id: 'socket-1',
      handshake: {
        auth: { token: 'Bearer valid-token' },
        headers: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      data: {},
    };
  });

  describe('handleConnection', () => {
    it('should authenticate and join rooms on connection', async () => {
      jwtService.verifyAccessToken.mockResolvedValue({ sub: 'user-1' } as any);
      prisma.membership.findMany.mockResolvedValue([{ spaceId: 'space-1' }] as any);

      await gateway.handleConnection(mockSocket);

      expect(jwtService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockSocket.data.userId).toBe('user-1');
      expect(mockSocket.join).toHaveBeenCalledWith('user:user-1');
      expect(mockSocket.join).toHaveBeenCalledWith('space:space-1');
      // Check that both status and last_seen were set (order matters: status first, then last_seen)
      expect(cacheService.set).toHaveBeenNthCalledWith(1, 'user:user-1:status', 'ONLINE', 180);
      expect(cacheService.set).toHaveBeenNthCalledWith(2, 'user:user-1:last_seen', expect.any(String), 90);
    });

    it('should disconnect client on authentication failure', async () => {
      jwtService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(mockSocket);

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleHeartbeat', () => {
    it('should update user presence score and last_seen', async () => {
      mockSocket.data = {
        userId: 'user-1',
        boards: new Set(['board-1']),
        tasks: new Set(['task-1']),
      };

      await gateway.handleHeartbeat(mockSocket);

      expect(cacheService.set).toHaveBeenCalledWith('user:user-1:last_seen', expect.any(String), 90);
      expect(cacheService.zadd).toHaveBeenCalledWith('presence:board:board-1', expect.any(Number), 'user-1');
      expect(cacheService.zadd).toHaveBeenCalledWith('presence:task:task-1', expect.any(Number), 'user-1');
    });
  });

  describe('joinBoard & leaveBoard', () => {
    beforeEach(() => {
      mockSocket.data = {
        userId: 'user-1',
        boards: new Set(),
      };
    });

    it('should join board presence if user is a member of the board space', async () => {
      prisma.board.findUnique.mockResolvedValue({
        department: { spaceId: 'space-1' },
      } as any);
      prisma.membership.findFirst.mockResolvedValue({ id: 'member-1' } as any);
      cacheService.zrange.mockResolvedValue(['user-1']);
      cacheService.hgetall.mockResolvedValue({ 'user-1': 'VIEWING' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Alice', avatarUrl: 'url' } as any);

      await gateway.joinBoard(mockSocket, 'board-1');

      expect(mockSocket.join).toHaveBeenCalledWith('board:board-1');
      expect(mockSocket.data.boards.has('board-1')).toBe(true);
      expect(cacheService.zadd).toHaveBeenCalledWith('presence:board:board-1', expect.any(Number), 'user-1');
      expect(cacheService.hset).toHaveBeenCalledWith('presence:board:board-1:states', 'user-1', 'VIEWING');
      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'board:presence', [
        { userId: 'user-1', name: 'Alice', avatarUrl: 'url', state: 'VIEWING' },
      ]);
    });

    it('should clean presence on leaveBoard if no other user socket is active', async () => {
      mockSocket.data.boards.add('board-1');
      mockServer.fetchSockets.mockResolvedValue([]); // No other sockets in board room
      cacheService.zrange.mockResolvedValue([]);

      await gateway.leaveBoard(mockSocket, 'board-1');

      expect(mockSocket.leave).toHaveBeenCalledWith('board:board-1');
      expect(mockSocket.data.boards.has('board-1')).toBe(false);
      expect(cacheService.zrem).toHaveBeenCalledWith('presence:board:board-1', 'user-1');
      expect(cacheService.hdel).toHaveBeenCalledWith('presence:board:board-1:states', 'user-1');
      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'board:presence', []);
    });
  });

  describe('joinTask, leaveTask & typingStatus', () => {
    beforeEach(() => {
      mockSocket.data = {
        userId: 'user-1',
        tasks: new Set(),
      };
    });

    it('should join task room if space member', async () => {
      prisma.task.findUnique.mockResolvedValue({
        board: { department: { spaceId: 'space-1' } },
      } as any);
      prisma.membership.findFirst.mockResolvedValue({ id: 'member-1' } as any);
      cacheService.zrange.mockResolvedValue(['user-1']);
      cacheService.hgetall.mockResolvedValue({ 'user-1': 'VIEWING' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Alice', avatarUrl: 'url' } as any);

      await gateway.joinTask(mockSocket, 'task-1');

      expect(mockSocket.join).toHaveBeenCalledWith('task:task-1');
      expect(mockSocket.data.tasks.has('task-1')).toBe(true);
      expect(cacheService.zadd).toHaveBeenCalledWith('presence:task:task-1', expect.any(Number), 'user-1');
      expect(mockServer.to).toHaveBeenCalledWith('task:task-1');
    });

    it('should update typing status and broadcast events', async () => {
      prisma.task.findUnique.mockResolvedValue({
        board: { department: { spaceId: 'space-1' } },
      } as any);
      prisma.membership.findFirst.mockResolvedValue({ id: 'member-1' } as any);
      cacheService.zrange.mockResolvedValue(['user-1']);
      cacheService.hgetall.mockResolvedValue({ 'user-1': 'TYPING' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Alice', avatarUrl: 'url' } as any);

      await gateway.taskTyping(mockSocket, { taskId: 'task-1', isTyping: true });

      expect(cacheService.hset).toHaveBeenCalledWith('presence:task:task-1:states', 'user-1', 'TYPING');
      expect(mockServer.emit).toHaveBeenCalledWith('task:typing-status', {
        taskId: 'task-1',
        userId: 'user-1',
        name: 'Alice',
        isTyping: true,
      });
    });
  });

  describe('handleDisconnect', () => {
    it('should clean presence for all boards and tasks user was in', async () => {
      mockSocket.data = {
        userId: 'user-1',
        boards: new Set(['board-1']),
        tasks: new Set(['task-1']),
      };
      mockServer.fetchSockets.mockResolvedValue([]); // No other sockets
      cacheService.zrange.mockResolvedValue([]);
      prisma.membership.findMany.mockResolvedValue([{ spaceId: 'space-1' }] as any);

      await gateway.handleDisconnect(mockSocket);

      expect(cacheService.zrem).toHaveBeenCalledWith('presence:board:board-1', 'user-1');
      expect(cacheService.zrem).toHaveBeenCalledWith('presence:task:task-1', 'user-1');
      expect(realtimeService.emitToBoard).toHaveBeenCalledWith('board-1', 'board:presence', []);
    });
  });
});
