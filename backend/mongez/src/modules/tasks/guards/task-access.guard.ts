import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class TaskAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.userId;
    if (!userId) return false;

    const taskId = req.params?.id || req.params?.taskId;
    if (!taskId) return true;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { board: { select: { department: { select: { spaceId: true } } } } },
    });

    if (!task) throw new NotFoundException('Task not found');

    const spaceId = task.board.department.spaceId;
    const membership = await this.prisma.membership.findFirst({
      where: { userId, spaceId },
    });

    if (!membership) throw new ForbiddenException('You do not have access to this task');

    req.taskSpaceId = spaceId;
    return true;
  }
}
