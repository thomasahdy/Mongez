import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateSpaceDto } from '../dto/create-space.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';

@Injectable()
export class SpaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly INCLUDE_SUMMARY = {
    _count: { select: { memberships: true, departments: true } },
  };

  async findById(id: string) {
    const space = await this.prisma.space.findUnique({ where: { id }, include: this.INCLUDE_SUMMARY });
    if (!space) return null;
    const boardCount = await this.prisma.board.count({
      where: { department: { spaceId: id }, isArchived: false }
    });
    return {
      ...space,
      _count: {
        ...space._count,
        boards: boardCount,
      }
    };
  }

  async findAllForUser(userId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;
    const where = { memberships: { some: { userId } } };
    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({ where, skip, take: limit, include: this.INCLUDE_SUMMARY, orderBy: { createdAt: 'desc' } }),
      this.prisma.space.count({ where }),
    ]);

    const data = await Promise.all(spaces.map(async (space) => {
      const boardCount = await this.prisma.board.count({
        where: { department: { spaceId: space.id }, isArchived: false }
      });
      return {
        ...space,
        _count: {
          ...space._count,
          boards: boardCount,
        }
      };
    }));

    return { data, total };
  }

  async create(dto: CreateSpaceDto, ownerId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Enforce unique prefix (per owner, not globally)
      const space = await tx.space.create({
        data: {
          name: dto.name,
          description: dto.description,
          icon: dto.icon,
          color: dto.color,
          prefix: dto.prefix?.toUpperCase() ?? 'PRJ',
        },
      });

      // 2. Initialise SpaceCounter for task identifiers
      await tx.spaceCounter.create({ data: { spaceId: space.id } });

      // 3. Find or create OWNER role
      const ownerRole = await tx.role.upsert({
        where: { name: 'OWNER' },
        update: {},
        create: { name: 'OWNER', description: 'Space Owner' }
      });

      // 4. Create owner membership
      await tx.membership.create({
        data: { userId: ownerId, spaceId: space.id, roleId: ownerRole.id },
      });

      return tx.space.findUnique({ where: { id: space.id }, include: this.INCLUDE_SUMMARY });
    });
  }

  async update(id: string, dto: UpdateSpaceDto) {
    return this.prisma.space.update({ where: { id }, data: dto, include: this.INCLUDE_SUMMARY });
  }

  async delete(id: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Delete from tables containing raw spaceId strings (not formal Prisma relations)
      await tx.workflowAction.deleteMany({ where: { instance: { spaceId: id } } });
      await tx.workflowInstance.deleteMany({ where: { spaceId: id } });
      await tx.workflowDefinition.deleteMany({ where: { spaceId: id } });
      await tx.usageRecord.deleteMany({ where: { spaceId: id } });
      await tx.aIProposedAction.deleteMany({ where: { spaceId: id } });
      await tx.aIRequest.deleteMany({ where: { spaceId: id } });
      await tx.aIConversationTurn.deleteMany({ where: { spaceId: id } });
      await tx.calendarEvent.deleteMany({ where: { spaceId: id } });
      await tx.googleCalendarSync.deleteMany({ where: { spaceId: id } });
      await tx.proposedTask.deleteMany({ where: { spaceId: id } });
      await tx.meeting.deleteMany({ where: { spaceId: id } });
      await tx.whatsAppMessage.deleteMany({ where: { spaceId: id } });
      await tx.whatsAppOtpCode.deleteMany({ where: { spaceId: id } });
      await tx.telegramMessage.deleteMany({ where: { spaceId: id } });
      await tx.approvalDelegate.deleteMany({ where: { spaceId: id } });
      await tx.userDelegation.deleteMany({ where: { spaceId: id } });

      // 2. Finally, delete the space itself (which triggers cascades for formal relations)
      return tx.space.delete({ where: { id } });
    });
  }

  async getStats(spaceId: string) {
    const [taskStats, memberCount] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['status'],
        where: { board: { department: { spaceId } }, isArchived: false },
        _count: { _all: true },
      }),
      this.prisma.membership.count({ where: { spaceId } }),
    ]);
    return { tasksByStatus: taskStats, memberCount };
  }
}

@Injectable()
export class DepartmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySpace(spaceId: string) {
    const depts = await this.prisma.department.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'asc' },
      include: {
        boards: {
          where: { isArchived: false },
          orderBy: { position: 'asc' as const },
          include: {
            _count: { select: { tasks: { where: { isArchived: false } } } }
          }
        },
        _count: { select: { boards: true } },
      },
    });

    return depts.map(dept => {
      const tasksCount = dept.boards.reduce((sum, board) => sum + (board._count?.tasks ?? 0), 0);
      return {
        ...dept,
        _count: {
          ...dept._count,
          tasks: tasksCount,
        }
      };
    });
  }

  async create(spaceId: string, data: { name: string; description?: string; color?: string }) {
    return this.prisma.department.create({ data: { ...data, spaceId } });
  }

  async update(id: string, data: { name?: string; description?: string; color?: string }) {
    return this.prisma.department.update({ where: { id }, data });
  }

  async delete(id: string) {
    const boardCount = await this.prisma.board.count({ where: { departmentId: id } });
    if (boardCount > 0) {
      throw new BadRequestException(`Cannot delete department with ${boardCount} boards. Delete or move boards first.`);
    }
    return this.prisma.department.delete({ where: { id } });
  }
}

@Injectable()
export class MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBySpace(spaceId: string) {
    return this.prisma.membership.findMany({
      where: { spaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } },
        role: { select: { name: true } },
      },
    });
  }

  async changeRole(userId: string, spaceId: string, roleName: string) {
    const role = await this.prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` }
    });
    return this.prisma.membership.update({
      where: { userId_spaceId: { userId, spaceId } },
      data: { roleId: role.id },
    });
  }

  async remove(userId: string, spaceId: string) {
    const member = await this.prisma.membership.findFirst({
      where: { userId, spaceId },
      include: { role: { select: { name: true } } },
    });
    if (!member) throw new NotFoundException('Membership not found');
    if (member.role.name === 'OWNER') {
      throw new ConflictException('Cannot remove the space owner');
    }
    return this.prisma.membership.delete({
      where: { userId_spaceId: { userId, spaceId } },
    });
  }
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingBySpace(spaceId: string) {
    return this.prisma.invitation.findMany({
      where: { spaceId, accepted: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByToken(token: string) {
    return this.prisma.invitation.findUnique({ where: { token }, include: { space: true } });
  }

  async create(spaceId: string, email: string, role: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.prisma.invitation.create({ data: { spaceId, email, role, expiresAt } });
  }

  async accept(token: string) {
    return this.prisma.invitation.update({ where: { token }, data: { accepted: true } });
  }

  async delete(id: string) {
    return this.prisma.invitation.delete({ where: { id } });
  }
}
