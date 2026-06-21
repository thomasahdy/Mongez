import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { resolveSpaceId } from '../../../common/utils/space-resolver';

@Injectable()
export class TaskAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.userId;
    if (!userId) return false;

    const taskId = req.params?.id || req.params?.taskId;
    if (!taskId) {
      const fallbackSpaceId = resolveSpaceId(req);
      if (fallbackSpaceId) {
        req.spaceId = fallbackSpaceId;
      }
      return true;
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { isArchived: true, board: { select: { department: { select: { spaceId: true } } } } },
    });

    if (!task || task.isArchived) throw new NotFoundException('Task not found');

    const spaceId = task.board.department.spaceId;
    const membership = await this.prisma.membership.findFirst({
      where: { userId, spaceId },
      select: { role: { select: { name: true } } },
    });

    if (!membership) throw new ForbiddenException('You do not have access to this task');

    req.spaceId = spaceId;
    req.taskSpaceId = spaceId;
    req.membershipRole = membership.role?.name ?? 'MEMBER';
    return true;
  }
}
