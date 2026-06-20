import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SpaceRepository } from '../spaces/repositories/spaces.repositories';
import { IdentifierService } from '../../shared/services/identifier.service';
import { Priority, TaskStatus } from '@prisma/client';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: jest.Mocked<PrismaService>;
  let spaceRepo: jest.Mocked<SpaceRepository>;
  let identifierService: jest.Mocked<IdentifierService>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      space: {
        findUnique: jest.fn(),
      },
    } as any;

    spaceRepo = {
      create: jest.fn(),
    } as any;

    identifierService = {
      nextIdentifier: jest.fn(),
    } as any;

    service = new OnboardingService(prisma, spaceRepo, identifierService);
  });

  describe('getTemplates()', () => {
    it('should return onboarding templates list', async () => {
      const templates = await service.getTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
    });
  });

  describe('setupSpaceFromTemplate()', () => {
    it('should throw NotFoundException if templateId is not found', async () => {
      await expect(
        service.setupSpaceFromTemplate('user-1', { name: 'New Space' } as any, 'invalid-template'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if space creation fails', async () => {
      spaceRepo.create.mockResolvedValue(null);

      await expect(
        service.setupSpaceFromTemplate('user-1', { name: 'New Space' } as any, 'software-dev'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should run transaction and seed departments, boards, columns, workflows, and welcome tasks', async () => {
      const mockSpace = { id: 'space-1', prefix: 'PRJ' };
      spaceRepo.create.mockResolvedValue(mockSpace as any);

      const tx = {
        department: { create: jest.fn().mockResolvedValue({ id: 'dept-1' }) },
        board: { create: jest.fn().mockResolvedValue({ id: 'board-1' }) },
        boardColumn: { create: jest.fn().mockResolvedValue({ id: 'col-1' }) },
        workflowDefinition: { create: jest.fn().mockResolvedValue({ id: 'flow-1' }) },
        workflowStep: { create: jest.fn().mockResolvedValue({ id: 'step-1' }) },
        task: { create: jest.fn().mockResolvedValue({ id: 'task-1' }) },
      };

      prisma.$transaction.mockImplementation(async (cb) => cb(tx));
      identifierService.nextIdentifier.mockResolvedValue('PRJ-001');
      prisma.space.findUnique.mockResolvedValue({
        id: 'space-1',
        departments: [
          {
            id: 'dept-1',
            boards: [
              {
                id: 'board-1',
                columns: [{ id: 'col-1' }],
              },
            ],
          },
        ],
      } as any);

      const result = await service.setupSpaceFromTemplate('user-1', { name: 'Mongez Project', prefix: 'PRJ' } as any, 'software-dev');

      expect(spaceRepo.create).toHaveBeenCalledWith({ name: 'Mongez Project', prefix: 'PRJ' }, 'user-1');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.department.create).toHaveBeenCalled();
      expect(tx.board.create).toHaveBeenCalled();
      expect(tx.boardColumn.create).toHaveBeenCalled();
      expect(tx.workflowDefinition.create).toHaveBeenCalled();
      expect(tx.workflowStep.create).toHaveBeenCalled();
      expect(tx.task.create).toHaveBeenCalled();
      expect(identifierService.nextIdentifier).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'space-1');
    });
  });
});
