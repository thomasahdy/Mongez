import { Test, TestingModule } from '@nestjs/testing';
import { SpaceRepository, DepartmentRepository, MembershipRepository, InvitationRepository } from './spaces.repositories';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

describe('Spaces Repositories', () => {
  let spaceRepo: SpaceRepository;
  let deptRepo: DepartmentRepository;
  let memberRepo: MembershipRepository;
  let inviteRepo: InvitationRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      space: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      spaceCounter: {
        create: jest.fn(),
      },
      role: {
        upsert: jest.fn(),
      },
      membership: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      invitation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      task: {
        groupBy: jest.fn(),
      },
      board: {
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceRepository,
        DepartmentRepository,
        MembershipRepository,
        InvitationRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    spaceRepo = module.get<SpaceRepository>(SpaceRepository);
    deptRepo = module.get<DepartmentRepository>(DepartmentRepository);
    memberRepo = module.get<MembershipRepository>(MembershipRepository);
    inviteRepo = module.get<InvitationRepository>(InvitationRepository);
  });

  describe('SpaceRepository', () => {
    it('UT-SPACE-REPO-001: should find unique space with relations', async () => {
      prisma.space.findUnique.mockResolvedValue({ id: 'space-1', name: 'Dev' } as any);

      const result = await spaceRepo.findById('space-1');

      expect(prisma.space.findUnique).toHaveBeenCalled();
      expect(result?.name).toBe('Dev');
    });

    it('UT-SPACE-REPO-002: should list all spaces for a user', async () => {
      prisma.space.findMany.mockResolvedValue([{ id: 'space-1' }] as any);
      prisma.space.count.mockResolvedValue(1);

      const result = await spaceRepo.findAllForUser('user-1', 1, 10);

      expect(prisma.space.findMany).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('UT-SPACE-REPO-003: should transactionally create space and owner membership', async () => {
      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          space: {
            create: jest.fn().mockResolvedValue({ id: 'space-1' }),
            findUnique: jest.fn().mockResolvedValue({ id: 'space-1', name: 'Product' }),
          },
          spaceCounter: {
            create: jest.fn().mockResolvedValue({}),
          },
          role: {
            upsert: jest.fn().mockResolvedValue({ id: 'owner-role-id' }),
          },
          membership: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await spaceRepo.create({ name: 'Product', prefix: 'PRD' }, 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result?.name).toBe('Product');
    });
  });

  describe('DepartmentRepository', () => {
    it('UT-DEPT-REPO-001: should query departments in a space', async () => {
      prisma.department.findMany.mockResolvedValue([{ id: 'dept-1' }] as any);

      const result = await deptRepo.findBySpace('space-1');

      expect(prisma.department.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('UT-DEPT-REPO-002: should delete department when no boards are linked', async () => {
      prisma.board.count.mockResolvedValue(0);
      prisma.department.delete.mockResolvedValue({ id: 'dept-1' } as any);

      await deptRepo.delete('dept-1');

      expect(prisma.board.count).toHaveBeenCalledWith({ where: { departmentId: 'dept-1' } });
      expect(prisma.department.delete).toHaveBeenCalledWith({ where: { id: 'dept-1' } });
    });

    it('UT-DEPT-REPO-003: should throw BadRequestException on delete if boards exist', async () => {
      prisma.board.count.mockResolvedValue(2);

      await expect(deptRepo.delete('dept-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('MembershipRepository', () => {
    it('UT-MEMBER-REPO-001: should retrieve space memberships', async () => {
      prisma.membership.findMany.mockResolvedValue([{ userId: 'user-1' }] as any);

      const result = await memberRepo.findBySpace('space-1');

      expect(prisma.membership.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('UT-MEMBER-REPO-002: should update membership role by upserting and updating', async () => {
      prisma.role.upsert.mockResolvedValue({ id: 'role-admin' } as any);
      prisma.membership.update.mockResolvedValue({ userId: 'user-1', roleId: 'role-admin' } as any);

      await memberRepo.changeRole('user-1', 'space-1', 'ADMIN');

      expect(prisma.role.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: 'ADMIN' } }),
      );
      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_spaceId: { userId: 'user-1', spaceId: 'space-1' } },
        }),
      );
    });

    it('UT-MEMBER-REPO-003: should remove membership if user is not OWNER', async () => {
      prisma.membership.findFirst.mockResolvedValue({
        userId: 'user-2',
        role: { name: 'MEMBER' },
      } as any);
      prisma.membership.delete.mockResolvedValue({} as any);

      await memberRepo.remove('user-2', 'space-1');

      expect(prisma.membership.delete).toHaveBeenCalled();
    });

    it('UT-MEMBER-REPO-004: should throw ConflictException if trying to remove OWNER', async () => {
      prisma.membership.findFirst.mockResolvedValue({
        userId: 'user-1',
        role: { name: 'OWNER' },
      } as any);

      await expect(memberRepo.remove('user-1', 'space-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('InvitationRepository', () => {
    it('UT-INVITE-REPO-001: should query pending active invitations', async () => {
      prisma.invitation.findMany.mockResolvedValue([{ id: 'inv-1' }] as any);

      const result = await inviteRepo.findPendingBySpace('space-1');

      expect(prisma.invitation.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('UT-INVITE-REPO-002: should accept invitation by updating accepted status', async () => {
      prisma.invitation.update.mockResolvedValue({ token: 'tok', accepted: true } as any);

      await inviteRepo.accept('tok');

      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { token: 'tok' },
        data: { accepted: true },
      });
    });
  });
});
