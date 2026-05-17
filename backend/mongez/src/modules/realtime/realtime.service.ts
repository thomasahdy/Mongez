import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server;

  setServer(server: Server) { 
    this.server = server; 
  }

  emitToBoard(boardId: string, event: string, payload: any) {
    this.server?.to(`board:${boardId}`).emit(event, payload);
  }

  emitToSpace(spaceId: string, event: string, payload: any) {
    this.server?.to(`space:${spaceId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
