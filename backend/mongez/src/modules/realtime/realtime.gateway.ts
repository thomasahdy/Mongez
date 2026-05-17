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
        client.join(`space:${m.spaceId}`);
      }

      // Initial heartbeat on connection
      await this.cacheService.set(`user:${payload.sub}:last_seen`, new Date().toISOString(), 60);

    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    if (client.data.userId) {
      await this.cacheService.set(`user:${client.data.userId}:last_seen`, new Date().toISOString(), 60);
    }
  }

  handleDisconnect(client: Socket) {
    // Socket.io handles room cleanup automatically
  }

  @SubscribeMessage('join:board')
  async joinBoard(@ConnectedSocket() client: Socket, @MessageBody() boardId: string) {
    if (!client.data.userId) return;

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { department: { select: { spaceId: true } } },
    });
    
    if (board) {
      const isMember = await this.prisma.membership.findFirst({
        where: { userId: client.data.userId, spaceId: board.department.spaceId },
      });
      if (isMember) {
        client.join(`board:${boardId}`);
      }
    }
  }

  @SubscribeMessage('leave:board')
  leaveBoard(@ConnectedSocket() client: Socket, @MessageBody() boardId: string) {
    client.leave(`board:${boardId}`);
  }
}
