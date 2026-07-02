import { Test, TestingModule } from '@nestjs/testing';
import { BoardRepository, ColumnRepository } from './boards.repositories';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('Boards Repositories', () => {
  let boardRepo: BoardRepository;
  let columnRepo: ColumnRepository;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      board: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      boardColumn: {
        findFirst: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      task: {
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoardRepository,
        ColumnRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    boardRepo = module.get<BoardRepository>(BoardRepository);
    columnRepo = module.get<ColumnRepository>(ColumnRepository);
  });

  describe('BoardRepository', () => {
    it('UT-BOARD-REPO-001: should query board with columns excluding soft-deleted', async () => {
      prisma.board.findFirst.mockResolvedValue({ id: 'board-1', columns: [] } as any);

      const result = await boardRepo.findById('board-1');

      expect(prisma.board.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'board-1', deletedAt: null } }),
      );
      expect(result?.id).toBe('board-1');
    });

    it('UT-BOARD-REPO-002: should list boards in department', async () => {
      prisma.board.findMany.mockResolvedValue([{ id: 'board-1' }] as any);
      prisma.board.count.mockResolvedValue(1);

      const result = await boardRepo.findByDepartment('dept-1', 1, 10);

      expect(result.total).toBe(1);
      expect(prisma.board.findMany).toHaveBeenCalled();
    });

    it('UT-BOARD-REPO-003: should create board and trigger columns auto-creation in transaction', async () => {
      const dto = { name: 'Dev Board', departmentId: 'dept-1', type: 'KANBAN' } as any;
      prisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          board: {
            create: jest.fn().mockResolvedValue({ id: 'board-1' }),
            findUnique: jest.fn().mockResolvedValue({ id: 'board-1', name: 'Dev Board' }),
          },
          boardColumn: {
            createMany: jest.fn().mockResolvedValue({ count: 4 }),
          },
        };
        return cb(tx);
      });

      const result = await boardRepo.create(dto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result?.name).toBe('Dev Board');
    });
  });

  describe('ColumnRepository', () => {
    it('UT-COLUMN-REPO-001: should create column with correct position offset', async () => {
      prisma.boardColumn.findFirst.mockResolvedValue({ position: 2 } as any);
      prisma.boardColumn.create.mockResolvedValue({ id: 'col-new', position: 3 } as any);

      const result = await columnRepo.create('board-1', { name: 'QA' } as any);

      expect(prisma.boardColumn.findFirst).toHaveBeenCalled();
      expect(prisma.boardColumn.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ position: 3 }) }),
      );
      expect(result.id).toBe('col-new');
    });

    it('UT-COLUMN-REPO-002: should delete column if it contains no active tasks', async () => {
      prisma.task.count.mockResolvedValue(0);
      prisma.boardColumn.delete.mockResolvedValue({ id: 'col-1' } as any);

      await columnRepo.delete('col-1');

      expect(prisma.task.count).toHaveBeenCalledWith({ where: { columnId: 'col-1', isArchived: false, deletedAt: null } });
      expect(prisma.boardColumn.delete).toHaveBeenCalledWith({ where: { id: 'col-1' } });
    });

    it('UT-COLUMN-REPO-003: should throw BadRequestException if column contains active tasks', async () => {
      prisma.task.count.mockResolvedValue(3);

      await expect(columnRepo.delete('col-1')).rejects.toThrow(BadRequestException);
    });

    it('UT-COLUMN-REPO-004: should reorder columns via transaction updates', async () => {
      prisma.boardColumn.update.mockResolvedValue({} as any);
      prisma.$transaction.mockResolvedValue([]);

      const dto = {
        columns: [
          { id: 'col-1', position: 1 },
          { id: 'col-2', position: 0 },
        ],
      };

      await columnRepo.reorder('board-1', dto);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
