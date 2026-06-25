import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { TraceContextService } from '../../infrastructure/logging/trace-context.service';
import {
  SpaceRepository,
  DepartmentRepository,
  MembershipRepository,
  InvitationRepository,
} from './repositories/spaces.repositories';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/membership.dto';
import { paginate } from '../../shared/dto/pagination.dto';

@Injectable()
export class SpacesService {
  private readonly CACHE_PREFIX = 'space';
  private readonly CACHE_TTL = 180;

  constructor(
    private readonly spaceRepo: SpaceRepository,
    private readonly deptRepo: DepartmentRepository,
    private readonly memberRepo: MembershipRepository,
    private readonly invitationRepo: InvitationRepository,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @InjectQueue(QUEUE_NAMES.WORKSPACE_EXPORT) private readonly workspaceExportQueue: Queue,
    private readonly traceContext: TraceContextService,
  ) {}

  // ─── Spaces ────────────────────────────────────────────────

  async getById(id: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${id}`,
      async () => {
        const space = await this.spaceRepo.findById(id);
        if (!space) throw new NotFoundException('Space not found');
        return space;
      },
      this.CACHE_TTL,
    );
  }

  async getAll(userId: string, page: number, limit: number) {
    const { data, total } = await this.spaceRepo.findAllForUser(userId, page, limit);
    return paginate(data, total, page, limit);
  }

  async create(dto: CreateSpaceDto, userId: string) {
    // Enforce subscription limit
    const subscription = await this.prisma.subscription.findFirst({ where: { userId } });
    if (subscription) {
      const plan = await this.prisma.subscriptionPlan.findFirst({
        where: { name: subscription.tier },
      });
      if (plan) {
        const ownedCount = await this.prisma.membership.count({
          where: { userId, role: { name: 'OWNER' } },
        });
        if (ownedCount >= plan.maxSpaces) {
          throw new ForbiddenException(
            `Your plan allows a maximum of ${plan.maxSpaces} spaces. Please upgrade.`,
          );
        }
      }
    }

    const space = await this.spaceRepo.create(dto, userId);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return space;
  }

  async update(id: string, dto: UpdateSpaceDto) {
    const space = await this.spaceRepo.update(id, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return space;
  }

  async delete(id: string) {
    await this.spaceRepo.delete(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }

  async getStats(spaceId: string) {
    return this.spaceRepo.getStats(spaceId);
  }

  // ─── Departments ───────────────────────────────────────────

  async getDepartments(spaceId: string) {
    return this.deptRepo.findBySpace(spaceId);
  }

  async createDepartment(spaceId: string, dto: CreateDepartmentDto) {
    return this.deptRepo.create(spaceId, dto);
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    return this.deptRepo.update(id, dto);
  }

  async deleteDepartment(id: string) {
    return this.deptRepo.delete(id); // throws if boards exist
  }

  // ─── Members ───────────────────────────────────────────────

  async getMembers(spaceId: string) {
    return this.memberRepo.findBySpace(spaceId);
  }

  async changeRole(spaceId: string, targetUserId: string, dto: UpdateMemberRoleDto, requesterId: string) {
    if (targetUserId === requesterId && dto.role !== 'OWNER') {
      // Prevent owner from demoting themselves (should transfer ownership first)
    }
    const result = await this.memberRepo.changeRole(targetUserId, spaceId, dto.role);
    await this.cache.del(`membership:${targetUserId}:${spaceId}`).catch(() => {});
    return result;
  }

  async removeMember(spaceId: string, targetUserId: string, requesterId: string) {
    if (targetUserId === requesterId) {
      throw new ForbiddenException('Use the leave endpoint to leave a space');
    }
    const result = await this.memberRepo.remove(targetUserId, spaceId);
    await this.cache.del(`membership:${targetUserId}:${spaceId}`).catch(() => {});
    return result;
  }

  async leaveSpace(spaceId: string, userId: string) {
    const result = await this.memberRepo.remove(userId, spaceId);
    await this.cache.del(`membership:${userId}:${spaceId}`).catch(() => {});
    return result;
  }

  // ─── Invitations ───────────────────────────────────────────

  async getPendingInvitations(spaceId: string) {
    return this.invitationRepo.findPendingBySpace(spaceId);
  }

  async inviteMember(spaceId: string, dto: InviteMemberDto) {
    // Check if user is already a member
    const existingMember = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        memberships: { some: { spaceId } },
      },
    });
    if (existingMember) {
      throw new ConflictException('This user is already a member of the space');
    }

    // Check if there's already a pending invite
    const pending = await this.prisma.invitation.findFirst({
      where: { email: dto.email, spaceId, accepted: false, expiresAt: { gt: new Date() } },
    });
    if (pending) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const invitation = await this.invitationRepo.create(spaceId, dto.email, dto.role ?? 'MEMBER');
    // TODO Phase 5: queue SEND_EMAIL job with invitation link
    // await this.queue.add(JOB_NAMES.SEND_EMAIL, {
    //   type: 'invitation',
    //   payload: { to: dto.email, token: invitation.token, spaceId }
    // });
    return invitation;
  }

  async cancelInvitation(inviteId: string) {
    return this.invitationRepo.delete(inviteId);
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.invitationRepo.findByToken(token);

    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.accepted) throw new ConflictException('Invitation already accepted');
    if (invitation.expiresAt < new Date()) {
      throw new ConflictException('Invitation has expired');
    }

    // Verify user email matches invitation
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email !== invitation.email) {
      throw new ForbiddenException('This invitation was sent to a different email address');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { name: invitation.role },
        update: {},
        create: { name: invitation.role, description: `${invitation.role} role` }
      });

      await tx.membership.create({
        data: { userId, spaceId: invitation.spaceId, roleId: role.id },
      });

      await tx.invitation.update({ where: { token }, data: { accepted: true } });
      return { message: 'Successfully joined the space', spaceId: invitation.spaceId };
    });

    await this.cache.del(`membership:${userId}:${invitation.spaceId}`).catch(() => {});
    return result;
  }

  async requestExport(spaceId: string, userId: string) {
    const space = await this.prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) throw new NotFoundException('Space not found');

    await this.workspaceExportQueue.add('workspace-export', {
      spaceId,
      userId,
      correlationId: this.traceContext.correlationId,
    });
    return { message: 'Workspace export started in the background. You will receive a notification when it is complete.' };
  }
}