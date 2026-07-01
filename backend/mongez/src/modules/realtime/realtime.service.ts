import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server;

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  setServer(server: Server) { 
    this.server = server; 
  }

  emitToBoard(boardId: string, event: string, payload: any) {
    this.publishToRedis('board', boardId, event, payload);
  }

  emitToBoardDirect(boardId: string, event: string, payload: any) {
    this.server?.to(`board:${boardId}`).emit(event, payload);
  }

  emitToSpace(spaceId: string, event: string, payload: any) {
    this.publishToRedis('space', spaceId, event, payload);
  }

  emitToSpaceDirect(spaceId: string, event: string, payload: any) {
    this.server?.to(`space:${spaceId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.publishToRedis('user', userId, event, payload);
  }

  emitToUserDirect(userId: string, event: string, payload: any) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToTask(taskId: string, event: string, payload: any) {
    this.publishToRedis('task', taskId, event, payload);
  }

  emitToTaskDirect(taskId: string, event: string, payload: any) {
    this.server?.to(`task:${taskId}`).emit(event, payload);
  }

  private publishToRedis(type: 'user' | 'space' | 'board' | 'task', targetId: string, event: string, payload: any) {
    const msg = JSON.stringify({ type, targetId, event, payload });
    this.redis.publish('realtime:events', msg).catch(err => {
      console.error('Failed to publish realtime event to Redis:', err);
    });
  }
}
