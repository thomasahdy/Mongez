import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { resolveSpaceId } from '../../../common/utils/space-resolver';

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
    const departmentId: string | undefined = req.body?.departmentId;

    let spaceId: string | undefined = resolveSpaceId(req);

    if (boardId) {
      const board = await this.prisma.board.findUnique({
        where: { id: boardId },
        select: { isArchived: true, department: { select: { spaceId: true } } },
      });
      if (!board || board.isArchived) throw new NotFoundException('Board not found');
      spaceId = board.department.spaceId;
    } else if (departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { spaceId: true },
      });
      if (!dept) throw new NotFoundException('Department not found');
      spaceId = dept.spaceId;
    }

    if (!spaceId) return true; // no board/department context — skip

    const membership = await this.prisma.membership.findFirst({
      where: { userId, spaceId },
      select: { role: { select: { name: true } } },
    });

    if (!membership) throw new ForbiddenException('You do not have access to this resource');

    req.spaceId = spaceId;
    req.boardSpaceId = spaceId;
    req.membershipRole = membership.role.name;
    return true;
  }
}
