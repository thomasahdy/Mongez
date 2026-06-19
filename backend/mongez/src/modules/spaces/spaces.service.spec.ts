import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SpacesService } from './spaces.service';
import {
  SpaceRepository,
  DepartmentRepository,
  MembershipRepository,
  InvitationRepository,
} from './repositories/spaces.repositories';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CacheService } from '../../infrastructure/cache/cache.service';

describe('SpacesService', () => {
  let service: SpacesService;
  let spaceRepo: jest.Mocked<SpaceRepository>;
  let deptRepo: jest.Mocked<DepartmentRepository>;
  let memberRepo: jest.Mocked<MembershipRepository>;
  let invitationRepo: jest.Mocked<InvitationRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let cache: jest.Mocked<CacheService>;

  const mockSpace = { id: 'space-1', name: 'Test Space' } as any;
  const mockInvitation = {
    id: 'inv-1',
    token: 'token-abc',
    spaceId: 'space-1',
    email: 'new@example.com',
    role: 'MEMBER',
    accepted: false,
    expiresAt: new Date(Date.now() + 86400000), // tomorrow
  } as any;

  beforeEach(() => {
    spaceRepo = {
      findById: jest.fn(),
      findAllForUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStats: jest.fn(),
    } as any;

    deptRepo = {
      findBySpace: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    memberRepo = {
      findBySpace: jest.fn(),
      changeRole: jest.fn(),
      remove: jest.fn(),
    } as any;

    invitationRepo = {
      findPendingBySpace: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findByToken: jest.fn(),
    } as any;

    prisma = {
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      subscriptionPlan: { findFirst: jest.fn() },
      membership: { count: jest.fn(), create: jest.fn() },
      user: { findFirst: jest.fn(), findUnique: jest.fn() },
      invitation: { findFirst: jest.fn() },
      role: { upsert: jest.fn() },
      $transaction: jest.fn(),
    } as any;

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      invalidateEntityType: jest.fn(),
    } as any;

    service = new SpacesService(spaceRepo, deptRepo, memberRepo, invitationRepo, prisma, cache);
  });

  // ─── getById ─────────────────────────────────────────────────

  describe('getById()', () => {
    it('UT-PROJ-SVC-001: should use 180s cache TTL for space lookups', async () => {
      cache.getOrSet.mockResolvedValue(mockSpace);

      await service.getById('space-1');

      expect(cache.getOrSet).toHaveBeenCalledWith('space:space-1', expect.any(Function), 180);
    });

    it('should fetch from repository on cache miss', async () => {
      cache.getOrSet.mockImplementation(async (_k, factory) => factory());
      spaceRepo.findById.mockResolvedValue(mockSpace);

      const result = await service.getById('space-1');

      expect(result).toEqual(mockSpace);
    });

    it('should throw NotFoundException when space not found', async () => {
      cache.getOrSet.mockImplementation(async (_k, factory) => factory());
      spaceRepo.findById.mockResolvedValue(null);

      await expect(service.getById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getAll ──────────────────────────────────────────────────

  describe('getAll()', () => {
    it('should return paginated spaces for user', async () => {
      spaceRepo.findAllForUser.mockResolvedValue({ data: [mockSpace], total: 1 } as any);

      const result = await service.getAll('user-1', 1, 10);

      expect(spaceRepo.findAllForUser).toHaveBeenCalledWith('user-1', 1, 10);
      expect(result).toMatchObject({ data: [mockSpace] });
    });
  });

  // ─── create ──────────────────────────────────────────────────

  describe('create()', () => {
    it('UT-PROJ-SVC-002: should create space and invalidate entity type cache', async () => {
      spaceRepo.create.mockResolvedValue(mockSpace);

      const result = await service.create({ name: 'New Space' } as any, 'user-1');

      expect(spaceRepo.create).toHaveBeenCalledWith({ name: 'New Space' }, 'user-1');
      expect(cache.invalidateEntityType).toHaveBeenCalledWith('space');
      expect(result).toEqual(mockSpace);
    });

    it('should throw ForbiddenException when subscription plan limit is reached', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ tier: 'FREE' } as any);
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ maxSpaces: 1 } as any);
      (prisma.membership.count as jest.Mock).mockResolvedValue(1);

      await expect(service.create({ name: 'Extra Space' } as any, 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create space when within plan limit', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ tier: 'PRO' } as any);
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ maxSpaces: 5 } as any);
      (prisma.membership.count as jest.Mock).mockResolvedValue(2);
      spaceRepo.create.mockResolvedValue(mockSpace);

      const result = await service.create({ name: 'My Space' } as any, 'user-1');

      expect(result).toEqual(mockSpace);
    });
  });

  // ─── update / delete ─────────────────────────────────────────

  describe('update()', () => {
    it('should update space and invalidate entity cache', async () => {
      spaceRepo.update.mockResolvedValue({ ...mockSpace, name: 'Updated' });

      await service.update('space-1', { name: 'Updated' });

      expect(cache.invalidateEntity).toHaveBeenCalledWith('space', 'space-1');
    });
  });

  describe('delete()', () => {
    it('should delete space and invalidate entity cache', async () => {
      spaceRepo.delete.mockResolvedValue(undefined as any);

      await service.delete('space-1');

      expect(spaceRepo.delete).toHaveBeenCalledWith('space-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('space', 'space-1');
    });
  });

  // ─── inviteMember ────────────────────────────────────────────

  describe('inviteMember()', () => {
    it('should throw ConflictException if user is already a member', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-existing' });

      await expect(
        service.inviteMember('space-1', { email: 'existing@example.com', role: 'MEMBER' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.inviteMember('space-1', { email: 'existing@example.com', role: 'MEMBER' }),
      ).rejects.toThrow('already a member');
    });

    it('should throw ConflictException if pending invitation already exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invitation.findFirst as jest.Mock).mockResolvedValue({ id: 'pending-inv' });

      await expect(
        service.inviteMember('space-1', { email: 'new@example.com', role: 'MEMBER' }),
      ).rejects.toThrow('A pending invitation already exists');
    });

    it('should create invitation when no conflicts exist', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invitation.findFirst as jest.Mock).mockResolvedValue(null);
      invitationRepo.create.mockResolvedValue(mockInvitation);

      const result = await service.inviteMember('space-1', { email: 'new@example.com', role: 'MEMBER' });

      expect(invitationRepo.create).toHaveBeenCalledWith('space-1', 'new@example.com', 'MEMBER');
      expect(result).toEqual(mockInvitation);
    });
  });

  // ─── acceptInvitation ────────────────────────────────────────

  describe('acceptInvitation()', () => {
    it('should throw NotFoundException if invitation not found', async () => {
      invitationRepo.findByToken.mockResolvedValue(null);

      await expect(service.acceptInvitation('bad-token', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if invitation already accepted', async () => {
      invitationRepo.findByToken.mockResolvedValue({ ...mockInvitation, accepted: true });

      await expect(service.acceptInvitation('token-abc', 'user-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.acceptInvitation('token-abc', 'user-1')).rejects.toThrow(
        'already accepted',
      );
    });

    it('should throw ConflictException if invitation is expired', async () => {
      invitationRepo.findByToken.mockResolvedValue({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      await expect(service.acceptInvitation('token-abc', 'user-1')).rejects.toThrow('expired');
    });

    it('should throw ForbiddenException when user email does not match invitation', async () => {
      invitationRepo.findByToken.mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'different@example.com' });

      await expect(service.acceptInvitation('token-abc', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create membership in transaction for valid invitation', async () => {
      invitationRepo.findByToken.mockResolvedValue(mockInvitation);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'new@example.com' });

      const txResult = { message: 'Successfully joined the space', spaceId: 'space-1' };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          role: { upsert: jest.fn().mockResolvedValue({ id: 'role-1' }) },
          membership: { create: jest.fn().mockResolvedValue({}) },
          invitation: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const result = await service.acceptInvitation('token-abc', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toMatchObject({ spaceId: 'space-1' });
    });
  });

  // ─── removeMember / leaveSpace ───────────────────────────────

  describe('removeMember()', () => {
    it('should throw ForbiddenException when trying to remove self', async () => {
      await expect(service.removeMember('space-1', 'user-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.removeMember('space-1', 'user-1', 'user-1')).rejects.toThrow(
        'leave endpoint',
      );
    });

    it('should remove different user from space', async () => {
      memberRepo.remove.mockResolvedValue(undefined as any);

      await service.removeMember('space-1', 'user-2', 'user-1');

      expect(memberRepo.remove).toHaveBeenCalledWith('user-2', 'space-1');
    });
  });

  describe('leaveSpace()', () => {
    it('should allow user to leave space', async () => {
      memberRepo.remove.mockResolvedValue(undefined as any);

      await service.leaveSpace('space-1', 'user-1');

      expect(memberRepo.remove).toHaveBeenCalledWith('user-1', 'space-1');
    });
  });

  // ─── Departments ─────────────────────────────────────────────

  describe('getDepartments()', () => {
    it('should return departments for space', async () => {
      deptRepo.findBySpace.mockResolvedValue([{ id: 'dept-1' }] as any);

      const result = await service.getDepartments('space-1');

      expect(deptRepo.findBySpace).toHaveBeenCalledWith('space-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('createDepartment()', () => {
    it('should create department', async () => {
      deptRepo.create.mockResolvedValue({ id: 'dept-1', name: 'Engineering' } as any);

      const result = await service.createDepartment('space-1', { name: 'Engineering' } as any);

      expect(deptRepo.create).toHaveBeenCalledWith('space-1', { name: 'Engineering' });
      expect(result.name).toBe('Engineering');
    });
  });
});
