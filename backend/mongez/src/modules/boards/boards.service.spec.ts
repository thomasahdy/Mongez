import { BoardsService } from './boards.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { BoardRepository, ColumnRepository } from './repositories/boards.repositories';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrashService } from '../trash/trash.service';

describe('BoardsService', () => {
  let service: BoardsService;
  let boardRepo: jest.Mocked<BoardRepository>;
  let columnRepo: jest.Mocked<ColumnRepository>;
  let cache: jest.Mocked<CacheService>;
  let prisma: jest.Mocked<PrismaService>;
  let subscriptions: jest.Mocked<SubscriptionsService>;
  let trashService: jest.Mocked<TrashService>;

  const mockBoard = { id: 'board-1', name: 'Sprint Board', columns: [] } as any;
  const mockColumn = { id: 'col-1', name: 'To Do', position: 0 } as any;

  beforeEach(() => {
    boardRepo = {
      findById: jest.fn(),
      findByDepartment: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
    } as any;

    columnRepo = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      reorder: jest.fn(),
    } as any;

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      invalidateEntityType: jest.fn(),
    } as any;

    prisma = {
      department: {
        findUnique: jest.fn(),
      },
      board: {
        count: jest.fn(),
      },
    } as any;

    subscriptions = {
      getPlan: jest.fn(),
    } as any;

    trashService = {
      softDeleteBoard: jest.fn(),
      softDeleteColumn: jest.fn(),
    } as any;

    service = new BoardsService(boardRepo, columnRepo, cache, prisma, subscriptions, trashService);
  });

  // ─── UT-BOARD-SVC-001: getById ──────────────────────────────

  describe('getById()', () => {
    it('UT-BOARD-SVC-001: should return cached board when cache hits', async () => {
      cache.getOrSet.mockResolvedValue(mockBoard);

      const result = await service.getById('board-1');

      expect(result).toEqual(mockBoard);
      expect(cache.getOrSet).toHaveBeenCalledWith('board:board-1:full', expect.any(Function), 60);
    });

    it('should query repository on cache miss and return board', async () => {
      cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<any>) => factory());
      boardRepo.findById.mockResolvedValue(mockBoard);

      const result = await service.getById('board-1');

      expect(boardRepo.findById).toHaveBeenCalledWith('board-1');
      expect(result).toEqual(mockBoard);
    });

    it('should throw NotFoundException on cache miss when board does not exist', async () => {
      cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<any>) => factory());
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.getById('non-existent')).rejects.toThrow('Board not found');
    });
  });

  // ─── UT-BOARD-SVC: getByDepartment ──────────────────────────

  describe('getByDepartment()', () => {
    it('should return paginated boards for department', async () => {
      boardRepo.findByDepartment.mockResolvedValue({ data: [mockBoard], total: 1 } as any);

      const result = await service.getByDepartment('dept-1', 1, 10);

      expect(boardRepo.findByDepartment).toHaveBeenCalledWith('dept-1', 1, 10);
      expect(result).toMatchObject({ data: [mockBoard] });
    });
  });

  // ─── UT-BOARD-SVC-003: create ───────────────────────────────

  describe('create()', () => {
    it('UT-BOARD-SVC-003: should create board and invalidate type cache', async () => {
      const dto = { name: 'New Board', departmentId: 'dept-1', type: 'KANBAN' as any };
      (prisma.department.findUnique as jest.Mock).mockResolvedValue({ spaceId: 'space-1' });
      (subscriptions.getPlan as jest.Mock).mockResolvedValue({ limits: { maxBoards: 10 } });
      (prisma.board.count as jest.Mock).mockResolvedValue(2);
      boardRepo.create.mockResolvedValue({ id: 'board-new', ...dto } as any);

      const result = await service.create(dto);

      expect(boardRepo.create).toHaveBeenCalledWith(dto);
      expect(cache.invalidateEntityType).toHaveBeenCalledWith('board');
      expect(result).toMatchObject({ name: 'New Board' });
    });
  });

  // ─── UT-BOARD-SVC: update ───────────────────────────────────

  describe('update()', () => {
    it('should update board and invalidate entity cache', async () => {
      boardRepo.update.mockResolvedValue({ ...mockBoard, name: 'Renamed' } as any);

      const result = await service.update('board-1', { name: 'Renamed' });

      expect(boardRepo.update).toHaveBeenCalledWith('board-1', { name: 'Renamed' });
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
      expect(result.name).toBe('Renamed');
    });
  });

  // ─── UT-BOARD-SVC: archive ──────────────────────────────────

  describe('archive()', () => {
    it('should archive board and invalidate entity cache', async () => {
      (trashService.softDeleteBoard as jest.Mock).mockResolvedValue(undefined);

      await service.archive('board-1', 'user-1');

      expect(trashService.softDeleteBoard).toHaveBeenCalledWith('board-1', 'user-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
    });
  });

  // ─── UT-BOARD-SVC: Column Operations ────────────────────────

  describe('addColumn()', () => {
    it('should create column and invalidate board entity cache', async () => {
      const dto = { name: 'In Review', position: 2 } as any;
      columnRepo.create.mockResolvedValue(mockColumn);

      const result = await service.addColumn('board-1', dto);

      expect(columnRepo.create).toHaveBeenCalledWith('board-1', dto);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
      expect(result).toEqual(mockColumn);
    });
  });

  describe('updateColumn()', () => {
    it('should update column and invalidate board entity cache', async () => {
      const dto = { name: 'Done' } as any;
      columnRepo.update.mockResolvedValue({ ...mockColumn, name: 'Done' });

      const result = await service.updateColumn('board-1', 'col-1', dto);

      expect(columnRepo.update).toHaveBeenCalledWith('col-1', dto);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
      expect(result.name).toBe('Done');
    });
  });

  describe('deleteColumn()', () => {
    it('should delete column and invalidate board entity cache', async () => {
      (trashService.softDeleteColumn as jest.Mock).mockResolvedValue(undefined);

      await service.deleteColumn('board-1', 'col-1', 'user-1');

      expect(trashService.softDeleteColumn).toHaveBeenCalledWith('col-1', 'user-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
    });
  });

  describe('reorderColumns()', () => {
    it('should reorder columns and invalidate board entity cache', async () => {
      const dto = { columnIds: ['col-2', 'col-1'] } as any;
      columnRepo.reorder.mockResolvedValue(undefined as any);

      const result = await service.reorderColumns('board-1', dto);

      expect(columnRepo.reorder).toHaveBeenCalledWith('board-1', dto);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
      expect(result).toMatchObject({ message: 'Columns reordered successfully' });
    });
  });
});