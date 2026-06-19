import { Test, TestingModule } from '@nestjs/testing';
import { BoardsController, DepartmentBoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardAccessGuard } from './guards/board-access.guard';

describe('BoardsController & DepartmentBoardsController', () => {
  let boardsController: BoardsController;
  let deptController: DepartmentBoardsController;
  let service: jest.Mocked<BoardsService>;

  const mockBoard = { id: 'board-1', name: 'Board Name', columns: [] };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      addColumn: jest.fn(),
      reorderColumns: jest.fn(),
      updateColumn: jest.fn(),
      deleteColumn: jest.fn(),
      getByDepartment: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoardsController, DepartmentBoardsController],
      providers: [
        { provide: BoardsService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BoardAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    boardsController = module.get<BoardsController>(BoardsController);
    deptController = module.get<DepartmentBoardsController>(DepartmentBoardsController);
  });

  describe('BoardsController', () => {
    it('UT-BOARD-CTRL-001: should create a new board with default columns', async () => {
      const dto = { name: 'Sprints', departmentId: 'dept-1', type: 'KANBAN' } as any;
      service.create.mockResolvedValue({ id: 'board-1', ...dto });

      const result = await boardsController.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('board-1');
    });

    it('UT-BOARD-CTRL-002: should fetch board by ID', async () => {
      service.getById.mockResolvedValue(mockBoard as any);

      const result = await boardsController.getById('board-1');

      expect(service.getById).toHaveBeenCalledWith('board-1');
      expect(result.id).toBe('board-1');
    });

    it('UT-BOARD-CTRL-003: should update board details', async () => {
      const dto = { name: 'New Name' };
      service.update.mockResolvedValue({ id: 'board-1', name: 'New Name' } as any);

      const result = await boardsController.update('board-1', dto);

      expect(service.update).toHaveBeenCalledWith('board-1', dto);
      expect(result.name).toBe('New Name');
    });

    it('UT-BOARD-CTRL-004: should archive a board', async () => {
      service.archive.mockResolvedValue(undefined);

      await boardsController.archive({ user: { userId: 'user-1' } } as any, 'board-1');

      expect(service.archive).toHaveBeenCalledWith('board-1', 'user-1');
    });

    it('UT-BOARD-CTRL-005: should add a column', async () => {
      const dto = { name: 'QA', position: 2 } as any;
      service.addColumn.mockResolvedValue({ id: 'col-1', ...dto });

      const result = await boardsController.addColumn('board-1', dto);

      expect(service.addColumn).toHaveBeenCalledWith('board-1', dto);
      expect(result.id).toBe('col-1');
    });

    it('UT-BOARD-CTRL-006: should reorder columns', async () => {
      const dto = { columnIds: ['col-2', 'col-1'] };
      service.reorderColumns.mockResolvedValue({ message: 'Success' } as any);

      const result = await boardsController.reorderColumns('board-1', dto);

      expect(service.reorderColumns).toHaveBeenCalledWith('board-1', dto);
      expect(result.message).toBe('Success');
    });

    it('UT-BOARD-CTRL-007: should update column details', async () => {
      const dto = { name: 'Revised QA' };
      service.updateColumn.mockResolvedValue({ id: 'col-1', name: 'Revised QA' } as any);

      const result = await boardsController.updateColumn('board-1', 'col-1', dto);

      expect(service.updateColumn).toHaveBeenCalledWith('board-1', 'col-1', dto);
      expect(result.name).toBe('Revised QA');
    });

    it('UT-BOARD-CTRL-008: should delete a column', async () => {
      service.deleteColumn.mockResolvedValue(undefined);

      await boardsController.deleteColumn({ user: { userId: 'user-1' } } as any, 'board-1', 'col-1');

      expect(service.deleteColumn).toHaveBeenCalledWith('board-1', 'col-1', 'user-1');
    });
  });

  describe('DepartmentBoardsController', () => {
    it('UT-BOARD-CTRL-009: should return paginated list of department boards', async () => {
      const pagination = { page: 1, limit: 10 };
      service.getByDepartment.mockResolvedValue({ data: [mockBoard], total: 1 } as any);

      const result = await deptController.getByDepartment('dept-1', pagination);

      expect(service.getByDepartment).toHaveBeenCalledWith('dept-1', 1, 10);
      expect(result.data).toHaveLength(1);
    });
  });
});
