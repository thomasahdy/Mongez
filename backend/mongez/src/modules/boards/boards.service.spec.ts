import { BoardsService } from './boards.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { BoardRepository, ColumnRepository } from './repositories/boards.repositories';
import { NotFoundException } from '@nestjs/common';

describe('BoardsService', () => {
  let service: BoardsService;
  let boardRepo: jest.Mocked<BoardRepository>;
  let columnRepo: jest.Mocked<ColumnRepository>;
  let cache: jest.Mocked<CacheService>;

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

    service = new BoardsService(boardRepo, columnRepo, cache);
  });

  describe('getById()', () => {
    it('UT-BOARD-SVC-001: should return cached board with columns', async () => {
      const mockBoard = { id: 'board-1', name: 'Sprint Board', columns: [] };
      cache.getOrSet.mockResolvedValue(mockBoard);

      const result = await service.getById('board-1');

      expect(result).toEqual(mockBoard);
      expect(cache.getOrSet).toHaveBeenCalledWith('board:board-1:full', expect.any(Function), 60);
    });

    it('should throw NotFoundException when board not found', async () => {
      cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<any>) => factory());
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('UT-BOARD-SVC-003: should create board and invalidate cache', async () => {
      const dto = { name: 'New Board', departmentId: 'dept-1', type: 'KANBAN' as any };
      boardRepo.create.mockResolvedValue({ id: 'board-new', ...dto } as any);

      await service.create(dto);

      expect(boardRepo.create).toHaveBeenCalledWith(dto);
      expect(cache.invalidateEntityType).toHaveBeenCalledWith('board');
    });
  });

  describe('update()', () => {
    it('should update board and invalidate entity cache', async () => {
      const updateData = { name: 'Updated Board' };
      boardRepo.update.mockResolvedValue({ id: 'board-1', ...updateData } as any);

      await service.update('board-1', updateData);

      expect(boardRepo.update).toHaveBeenCalledWith('board-1', updateData);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
    });
  });

  describe('archive()', () => {
    it('should archive board and invalidate entity cache', async () => {
      boardRepo.archive.mockResolvedValue(undefined as any);

      await service.archive('board-1');

      expect(boardRepo.archive).toHaveBeenCalledWith('board-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
    });
  });
});