import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '../auth/services/jwt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RealtimeService } from './realtime.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { Cron } from '@nestjs/schedule';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true },
  namespace: '/ws',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly cacheService: CacheService,
  ) {}

  @Cron('*/30 * * * * *')
  async cleanGhostUsers() {
    const redis = (this.cacheService as any).redis;
    if (!redis) return;

    try {
      const boardKeys = await redis.keys('presence:board:*');
      const now = Date.now();

      for (const key of boardKeys) {
        if (key.endsWith(':states')) continue;
        const boardId = key.replace('presence:board:', '');
        const initialUsers = await this.cacheService.zrange(key, 0, -1);
        
        await this.cacheService.zremrangebyscore(key, 0, now);
        
        const remainingUsers = await this.cacheService.zrange(key, 0, -1);
        if (initialUsers.length !== remainingUsers.length) {
          const removedUsers = initialUsers.filter((u: string) => !remainingUsers.includes(u));
          for (const u of removedUsers) {
            await this.cacheService.hdel(`presence:board:${boardId}:states`, u);
          }
          await this.broadcastBoardPresence(boardId);
        }
      }

      const taskKeys = await redis.keys('presence:task:*');
      for (const key of taskKeys) {
        if (key.endsWith(':states')) continue;
        const taskId = key.replace('presence:task:', '');
        const initialUsers = await this.cacheService.zrange(key, 0, -1);
        
        await this.cacheService.zremrangebyscore(key, 0, now);
        
        const remainingUsers = await this.cacheService.zrange(key, 0, -1);
        if (initialUsers.length !== remainingUsers.length) {
          const removedUsers = initialUsers.filter((u: string) => !remainingUsers.includes(u));
          for (const u of removedUsers) {
            await this.cacheService.hdel(`presence:task:${taskId}:states`, u);
          }
          await this.broadcastTaskPresence(taskId);
        }
      }
    } catch (err: any) {
      // Don't crash gateway on periodic cleanup error
    }
  }

  afterInit(server: Server) {
    this.realtimeService.setServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth.token || client.handshake.headers.authorization)?.replace('Bearer ', '');
      if (!token) throw new Error('No token');

      const payload = await this.jwtService.verifyAccessToken(token);
      client.data.userId = payload.sub;

      client.join(`user:${payload.sub}`);

      const memberships = await this.prisma.membership.findMany({
        where: { userId: payload.sub },
        select: { spaceId: true },
      });
      for (const m of memberships) {
        if (m.spaceId) {
          client.join(`space:${m.spaceId}`);
        }
      }

      client.data.boards = new Set<string>();
      client.data.tasks = new Set<string>();

      // Initial heartbeat on connection
      await this.cacheService.set(`user:${payload.sub}:last_seen`, new Date().toISOString(), 60);

    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const now = Date.now();
      const expirationScore = now + 60000;

      await this.cacheService.set(`user:${userId}:last_seen`, new Date().toISOString(), 60);

      // Heartbeat updates score for all active boards the user is on
      if (client.data.boards) {
        for (const boardId of client.data.boards) {
          await this.cacheService.zadd(`presence:board:${boardId}`, expirationScore, userId);
        }
      }

      // Heartbeat updates score for all active tasks the user is on
      if (client.data.tasks) {
        for (const taskId of client.data.tasks) {
          await this.cacheService.zadd(`presence:task:${taskId}`, expirationScore, userId);
        }
      }
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    if (client.data.boards) {
      for (const boardId of client.data.boards) {
        const sockets = await this.server.in(`board:${boardId}`).fetchSockets();
        const stillPresent = sockets.some(
          (s) => s.data.userId === userId && s.id !== client.id,
        );

        if (!stillPresent) {
          await this.cacheService.zrem(`presence:board:${boardId}`, userId);
          await this.cacheService.hdel(`presence:board:${boardId}:states`, userId);
        }
        await this.broadcastBoardPresence(boardId);
      }
    }

    if (client.data.tasks) {
      for (const taskId of client.data.tasks) {
        const sockets = await this.server.in(`task:${taskId}`).fetchSockets();
        const stillPresent = sockets.some(
          (s) => s.data.userId === userId && s.id !== client.id,
        );

        if (!stillPresent) {
          await this.cacheService.zrem(`presence:task:${taskId}`, userId);
          await this.cacheService.hdel(`presence:task:${taskId}:states`, userId);
        }
        await this.broadcastTaskPresence(taskId);
      }
    }
  }

  @SubscribeMessage('join:board')
  async joinBoard(@ConnectedSocket() client: Socket, @MessageBody() boardId: string) {
    const userId = client.data.userId;
    if (!userId) return;

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { department: { select: { spaceId: true } } },
    });
    
    if (board) {
      const isMember = await this.prisma.membership.findFirst({
        where: { userId, spaceId: board.department.spaceId },
      });
      if (isMember) {
        client.join(`board:${boardId}`);
        client.data.boards = client.data.boards || new Set<string>();
        client.data.boards.add(boardId);

        const presenceKey = `presence:board:${boardId}`;
        const statesKey = `presence:board:${boardId}:states`;
        const expirationScore = Date.now() + 60000;

        await this.cacheService.zadd(presenceKey, expirationScore, userId);
        await this.cacheService.hset(statesKey, userId, 'VIEWING');

        await this.broadcastBoardPresence(boardId);
      }
    }
  }

  @SubscribeMessage('leave:board')
  async leaveBoard(@ConnectedSocket() client: Socket, @MessageBody() boardId: string) {
    const userId = client.data.userId;
    if (!userId) return;

    client.leave(`board:${boardId}`);
    if (client.data.boards) {
      client.data.boards.delete(boardId);
    }

    const sockets = await this.server.in(`board:${boardId}`).fetchSockets();
    const stillPresent = sockets.some(
      (s) => s.data.userId === userId && s.id !== client.id,
    );

    if (!stillPresent) {
      const presenceKey = `presence:board:${boardId}`;
      const statesKey = `presence:board:${boardId}:states`;

      await this.cacheService.zrem(presenceKey, userId);
      await this.cacheService.hdel(statesKey, userId);
    }

    await this.broadcastBoardPresence(boardId);
  }

  @SubscribeMessage('join:task')
  async joinTask(@ConnectedSocket() client: Socket, @MessageBody() taskId: string) {
    const userId = client.data.userId;
    if (!userId) return;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        board: {
          select: {
            department: {
              select: { spaceId: true },
            },
          },
        },
      },
    });

    if (task) {
      const isMember = await this.prisma.membership.findFirst({
        where: { userId, spaceId: task.board.department.spaceId },
      });

      if (isMember) {
        client.join(`task:${taskId}`);
        client.data.tasks = client.data.tasks || new Set<string>();
        client.data.tasks.add(taskId);

        const presenceKey = `presence:task:${taskId}`;
        const statesKey = `presence:task:${taskId}:states`;
        const expirationScore = Date.now() + 60000;

        await this.cacheService.zadd(presenceKey, expirationScore, userId);
        await this.cacheService.hset(statesKey, userId, 'VIEWING');

        await this.broadcastTaskPresence(taskId);
      }
    }
  }

  @SubscribeMessage('leave:task')
  async leaveTask(@ConnectedSocket() client: Socket, @MessageBody() taskId: string) {
    const userId = client.data.userId;
    if (!userId) return;

    client.leave(`task:${taskId}`);
    if (client.data.tasks) {
      client.data.tasks.delete(taskId);
    }

    const sockets = await this.server.in(`task:${taskId}`).fetchSockets();
    const stillPresent = sockets.some(
      (s) => s.data.userId === userId && s.id !== client.id,
    );

    if (!stillPresent) {
      const presenceKey = `presence:task:${taskId}`;
      const statesKey = `presence:task:${taskId}:states`;

      await this.cacheService.zrem(presenceKey, userId);
      await this.cacheService.hdel(statesKey, userId);
    }

    await this.broadcastTaskPresence(taskId);
  }

  @SubscribeMessage('task:typing')
  async taskTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { taskId: string; isTyping: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const task = await this.prisma.task.findUnique({
      where: { id: payload.taskId },
      select: {
        board: {
          select: {
            department: {
              select: { spaceId: true },
            },
          },
        },
      },
    });

    if (task) {
      const isMember = await this.prisma.membership.findFirst({
        where: { userId, spaceId: task.board.department.spaceId },
      });

      if (isMember) {
        const statesKey = `presence:task:${payload.taskId}:states`;
        const nextState = payload.isTyping ? 'TYPING' : 'VIEWING';
        await this.cacheService.hset(statesKey, userId, nextState);

        const profile = await this.getUserProfile(userId);
        if (profile) {
          this.server.to(`task:${payload.taskId}`).emit('task:typing-status', {
            userId,
            name: profile.name,
            isTyping: payload.isTyping,
          });
        }

        await this.broadcastTaskPresence(payload.taskId);
      }
    }
  }

  private async getUserProfile(userId: string) {
    const cacheKey = `user:profile:${userId}`;
    let profile = await this.cacheService.get<{ id: string; name: string; avatarUrl: string | null }>(cacheKey);

    if (!profile) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatarUrl: true },
      });

      if (user) {
        profile = user;
        await this.cacheService.set(cacheKey, profile, 3600); // cache for 1 hour
      }
    }
    return profile;
  }

  private async broadcastBoardPresence(boardId: string) {
    const presenceKey = `presence:board:${boardId}`;
    const statesKey = `presence:board:${boardId}:states`;
    const now = Date.now();

    // Clean expired presences
    await this.cacheService.zremrangebyscore(presenceKey, 0, now);

    // Get active user IDs
    const userIds = await this.cacheService.zrange(presenceKey, 0, -1);
    if (userIds.length === 0) {
      this.realtimeService.emitToBoard(boardId, 'board:presence', []);
      return;
    }

    // Get user states
    const states = await this.cacheService.hgetall(statesKey);

    // Fetch user profiles and build presence list
    const presenceList = (
      await Promise.all(
        userIds.map(async (id) => {
          const profile = await this.getUserProfile(id);
          if (!profile) return null;
          return {
            userId: id,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            state: states[id] || 'VIEWING',
          };
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    this.realtimeService.emitToBoard(boardId, 'board:presence', presenceList);
  }

  private async broadcastTaskPresence(taskId: string) {
    const presenceKey = `presence:task:${taskId}`;
    const statesKey = `presence:task:${taskId}:states`;
    const now = Date.now();

    // Clean expired presences
    await this.cacheService.zremrangebyscore(presenceKey, 0, now);

    // Get active user IDs
    const userIds = await this.cacheService.zrange(presenceKey, 0, -1);
    if (userIds.length === 0) {
      this.server.to(`task:${taskId}`).emit('task:presence', []);
      return;
    }

    // Get user states
    const states = await this.cacheService.hgetall(statesKey);

    // Fetch user profiles and build presence list
    const presenceList = (
      await Promise.all(
        userIds.map(async (id) => {
          const profile = await this.getUserProfile(id);
          if (!profile) return null;
          return {
            userId: id,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            state: states[id] || 'VIEWING',
          };
        }),
      )
    ).filter((item): item is NonNullable<typeof item> => item !== null);

    this.server.to(`task:${taskId}`).emit('task:presence', presenceList);
  }
}
