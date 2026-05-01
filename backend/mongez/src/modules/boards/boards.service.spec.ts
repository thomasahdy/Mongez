import { BoardsService } from './boards.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { BoardRepository } from './board.repository';
import { NotFoundException } from '@nestjs/common';

describe('BoardsService', () => {
  let service: BoardsService;
  let boardRepo: jest.Mocked<BoardRepository>;
  let cache: jest.Mocked<CacheService>;

  beforeEach(() => {
    boardRepo = {
      findById: jest.fn(),
      findByDepartmentId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    cache = {
      getOrSet: jest.fn(),
      invalidateEntity: jest.fn(),
      invalidateEntityType: jest.fn(),
    } as any;

    service = new BoardsService(boardRepo, cache);
  });

  describe('getBoardById()', () => {
    it('UT-BOARD-SVC-001: should return cached board with columns', async () => {
      const mockBoard = { id: 'board-1', name: 'Sprint Board', columns: [] };
      cache.getOrSet.mockResolvedValue(mockBoard);

      const result = await service.getBoardById('board-1');

      expect(result).toEqual(mockBoard);
      expect(cache.getOrSet).toHaveBeenCalledWith(
        'board:board-1',
        expect.any(Function),
        120,
      );
    });

    it('should throw NotFoundException when board not found', async () => {
      cache.getOrSet.mockImplementation(async (_key: string, factory: () => Promise<any>) => factory());
      boardRepo.findById.mockResolvedValue(null);

      await expect(service.getBoardById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDepartmentBoards()', () => {
    it('UT-BOARD-SVC-002: should return cached department board list', async () => {
      const mockBoards = [{ id: 'board-1', name: 'Board 1' }];
      cache.getOrSet.mockResolvedValue(mockBoards);

      const result = await service.getDepartmentBoards('dept-1');

      expect(result).toEqual(mockBoards);
      expect(cache.getOrSet).toHaveBeenCalledWith(
        'department:dept-1:boards',
        expect.any(Function),
        120,
      );
    });
  });

  describe('createBoard()', () => {
    it('UT-BOARD-SVC-003: should create board and invalidate cache', async () => {
      const newData = { name: 'New Board', departmentId: 'dept-1' };
      boardRepo.create.mockResolvedValue({ id: 'board-new', ...newData } as any);

      await service.createBoard(newData);

      expect(boardRepo.create).toHaveBeenCalledWith(newData);
      expect(cache.invalidateEntityType).toHaveBeenCalledWith('board');
    });
  });

  describe('updateBoard()', () => {
    it('should update board and invalidate entity cache', async () => {
      const updateData = { name: 'Updated Board' };
      boardRepo.update.mockResolvedValue({ id: 'board-1', ...updateData } as any);

      await service.updateBoard('board-1', updateData);

      expect(boardRepo.update).toHaveBeenCalledWith('board-1', updateData);
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
    });
  });

  describe('deleteBoard()', () => {
    it('should delete board and invalidate entity cache', async () => {
      boardRepo.delete.mockResolvedValue(undefined as any);

      await service.deleteBoard('board-1');

      expect(boardRepo.delete).toHaveBeenCalledWith('board-1');
      expect(cache.invalidateEntity).toHaveBeenCalledWith('board', 'board-1');
    });
  });
});