import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * BoardAccessGuard — resolves the space from a boardId in route params
 * and checks that the requesting user is a member of that space.
 *
 * Attaches req.boardSpaceId for downstream use.
 * Used on all board-scoped routes where :id or :boardId is a board ID.
 */
@Injectable()
export class BoardAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.userId;
    if (!userId) return false;

    const boardId: string | undefined = req.params?.boardId || req.params?.id;
    if (!boardId) return true; // no board context — skip

    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { department: { select: { spaceId: true } } },
    });

    if (!board) throw new NotFoundException('Board not found');

    const spaceId = board.department.spaceId;
    const membership = await this.prisma.membership.findFirst({
      where: { userId, spaceId },
    });

    if (!membership) throw new ForbiddenException('You do not have access to this board');

    req.boardSpaceId = spaceId;
    return true;
  }
}
