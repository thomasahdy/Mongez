import { Test, TestingModule } from '@nestjs/testing';
import { SpacesController, InvitationsController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpaceMemberGuard } from './guards/space-member.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

describe('SpacesController & InvitationsController', () => {
  let spacesController: SpacesController;
  let invitationsController: InvitationsController;
  let service: jest.Mocked<SpacesService>;

  const mockSpace = { id: 'space-1', name: 'Product Dev' };
  const mockUser = { userId: 'user-1' };
  const mockRequest = { user: mockUser } as any;

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStats: jest.fn(),
      getDepartments: jest.fn(),
      createDepartment: jest.fn(),
      updateDepartment: jest.fn(),
      deleteDepartment: jest.fn(),
      getMembers: jest.fn(),
      changeRole: jest.fn(),
      removeMember: jest.fn(),
      leaveSpace: jest.fn(),
      inviteMember: jest.fn(),
      getPendingInvitations: jest.fn(),
      cancelInvitation: jest.fn(),
      acceptInvitation: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpacesController, InvitationsController],
      providers: [
        { provide: SpacesService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SpaceMemberGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    spacesController = module.get<SpacesController>(SpacesController);
    invitationsController = module.get<InvitationsController>(InvitationsController);
  });

  describe('SpacesController', () => {
    it('UT-SPACE-CTRL-001: should create space delegating to service', async () => {
      const dto = { name: 'My New Space' } as any;
      service.create.mockResolvedValue({ id: 'space-new', ...dto });

      const result = await spacesController.create(mockRequest, dto);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
      expect(result.id).toBe('space-new');
    });

    it('UT-SPACE-CTRL-002: should list user spaces with pagination', async () => {
      const pagination = { page: 1, limit: 10 };
      service.getAll.mockResolvedValue({ data: [mockSpace], total: 1 } as any);

      const result = await spacesController.getAll(mockRequest, pagination);

      expect(service.getAll).toHaveBeenCalledWith('user-1', 1, 10);
      expect(result.data).toHaveLength(1);
    });

    it('UT-SPACE-CTRL-003: should fetch space detail by id', async () => {
      service.getById.mockResolvedValue(mockSpace as any);

      const result = await spacesController.getById('space-1');

      expect(service.getById).toHaveBeenCalledWith('space-1');
      expect(result.id).toBe('space-1');
    });

    it('UT-SPACE-CTRL-004: should update space information', async () => {
      const dto = { name: 'Updated Space' };
      service.update.mockResolvedValue({ id: 'space-1', ...dto } as any);

      const result = await spacesController.update('space-1', dto);

      expect(service.update).toHaveBeenCalledWith('space-1', dto);
      expect(result.name).toBe('Updated Space');
    });

    it('UT-SPACE-CTRL-005: should delete a space', async () => {
      service.delete.mockResolvedValue(undefined);

      await spacesController.delete('space-1');

      expect(service.delete).toHaveBeenCalledWith('space-1');
    });

    it('UT-SPACE-CTRL-006: should get space statistics', async () => {
      const stats = { tasksCount: 10, membersCount: 3 };
      service.getStats.mockResolvedValue(stats as any);

      const result = await spacesController.getStats('space-1');

      expect(service.getStats).toHaveBeenCalledWith('space-1');
      expect(result.tasksCount).toBe(10);
    });

    it('UT-SPACE-CTRL-007: should fetch departments in space', async () => {
      service.getDepartments.mockResolvedValue([{ id: 'dept-1' }] as any);

      const result = await spacesController.getDepartments('space-1');

      expect(service.getDepartments).toHaveBeenCalledWith('space-1');
      expect(result).toHaveLength(1);
    });

    it('UT-SPACE-CTRL-008: should create department in space', async () => {
      const dto = { name: 'IT' } as any;
      service.createDepartment.mockResolvedValue({ id: 'dept-new', ...dto });

      const result = await spacesController.createDepartment('space-1', dto);

      expect(service.createDepartment).toHaveBeenCalledWith('space-1', dto);
      expect(result.id).toBe('dept-new');
    });

    it('UT-SPACE-CTRL-009: should update department details', async () => {
      const dto = { name: 'Support' } as any;
      service.updateDepartment.mockResolvedValue({ id: 'dept-1', ...dto });

      const result = await spacesController.updateDepartment('dept-1', dto);

      expect(service.updateDepartment).toHaveBeenCalledWith('dept-1', dto);
      expect(result.name).toBe('Support');
    });

    it('UT-SPACE-CTRL-010: should delete department', async () => {
      service.deleteDepartment.mockResolvedValue(undefined);

      await spacesController.deleteDepartment('dept-1');

      expect(service.deleteDepartment).toHaveBeenCalledWith('dept-1');
    });

    it('UT-SPACE-CTRL-011: should list space members', async () => {
      service.getMembers.mockResolvedValue([{ id: 'member-1' }] as any);

      const result = await spacesController.getMembers('space-1');

      expect(service.getMembers).toHaveBeenCalledWith('space-1');
      expect(result).toHaveLength(1);
    });

    it('UT-SPACE-CTRL-012: should update member role', async () => {
      const dto = { role: 'ADMIN' } as any;
      service.changeRole.mockResolvedValue({ id: 'm-1', role: 'ADMIN' } as any);

      const result = await spacesController.changeRole(mockRequest, 'space-1', 'user-2', dto);

      expect(service.changeRole).toHaveBeenCalledWith('space-1', 'user-2', dto, 'user-1');
      expect(result.role).toBe('ADMIN');
    });

    it('UT-SPACE-CTRL-013: should remove member from space', async () => {
      service.removeMember.mockResolvedValue(undefined);

      await spacesController.removeMember(mockRequest, 'space-1', 'user-2');

      expect(service.removeMember).toHaveBeenCalledWith('space-1', 'user-2', 'user-1');
    });

    it('UT-SPACE-CTRL-014: should allow user to leave space', async () => {
      service.leaveSpace.mockResolvedValue(undefined);

      await spacesController.leaveSpace(mockRequest, 'space-1');

      expect(service.leaveSpace).toHaveBeenCalledWith('space-1', 'user-1');
    });

    it('UT-SPACE-CTRL-015: should invite user by email', async () => {
      const dto = { email: 'guest@example.com', role: 'MEMBER' } as any;
      service.inviteMember.mockResolvedValue({ id: 'invite-1', ...dto });

      const result = await spacesController.inviteMember('space-1', dto);

      expect(service.inviteMember).toHaveBeenCalledWith('space-1', dto);
      expect(result.id).toBe('invite-1');
    });

    it('UT-SPACE-CTRL-016: should list pending invitations', async () => {
      service.getPendingInvitations.mockResolvedValue([{ id: 'invite-1' }] as any);

      const result = await spacesController.getPendingInvitations('space-1');

      expect(service.getPendingInvitations).toHaveBeenCalledWith('space-1');
      expect(result).toHaveLength(1);
    });

    it('UT-SPACE-CTRL-017: should cancel pending invitation', async () => {
      service.cancelInvitation.mockResolvedValue(undefined);

      await spacesController.cancelInvitation('invite-1');

      expect(service.cancelInvitation).toHaveBeenCalledWith('invite-1');
    });
  });

  describe('InvitationsController', () => {
    it('UT-SPACE-CTRL-018: should accept invitation using token', async () => {
      service.acceptInvitation.mockResolvedValue({ success: true, spaceId: 'space-1' });

      const result = await invitationsController.acceptInvitation(mockRequest, 'token-123');

      expect(service.acceptInvitation).toHaveBeenCalledWith('token-123', 'user-1');
      expect(result.spaceId).toBe('space-1');
    });
  });
});
