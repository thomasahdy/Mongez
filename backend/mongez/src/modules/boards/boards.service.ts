import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { BoardRepository, ColumnRepository } from './repositories/boards.repositories';
import {
  CreateBoardDto,
  UpdateBoardDto,
  CreateColumnDto,
  UpdateColumnDto,
  ReorderColumnsDto,
} from './dto/boards.dto';
import { paginate } from '../../shared/dto/pagination.dto';

@Injectable()
export class BoardsService {
  private readonly CACHE_PREFIX = 'board';
  private readonly CACHE_TTL = 60; // 1 minute

  constructor(
    private readonly boardRepo: BoardRepository,
    private readonly columnRepo: ColumnRepository,
    private readonly cache: CacheService,
  ) {}

  // ─── Boards ────────────────────────────────────────────────

  async getById(id: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${id}:full`,
      async () => {
        const board = await this.boardRepo.findById(id);
        if (!board) throw new NotFoundException('Board not found');
        return board;
      },
      this.CACHE_TTL,
    );
  }

  async getByDepartment(departmentId: string, page: number, limit: number) {
    const { data, total } = await this.boardRepo.findByDepartment(departmentId, page, limit);
    return paginate(data, total, page, limit);
  }

  async create(dto: CreateBoardDto) {
    const board = await this.boardRepo.create(dto);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return board;
  }

  async update(id: string, dto: UpdateBoardDto) {
    const board = await this.boardRepo.update(id, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return board;
  }

  async archive(id: string): Promise<void> {
    await this.boardRepo.archive(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }

  // ─── Columns ───────────────────────────────────────────────

  async addColumn(boardId: string, dto: CreateColumnDto) {
    const column = await this.columnRepo.create(boardId, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, boardId);
    return column;
  }

  async updateColumn(boardId: string, colId: string, dto: UpdateColumnDto) {
    const col = await this.columnRepo.update(colId, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, boardId);
    return col;
  }

  async deleteColumn(boardId: string, colId: string): Promise<void> {
    await this.columnRepo.delete(colId); // throws BadRequestException if tasks exist
    await this.cache.invalidateEntity(this.CACHE_PREFIX, boardId);
  }

  async reorderColumns(boardId: string, dto: ReorderColumnsDto) {
    await this.columnRepo.reorder(boardId, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, boardId);
    return { message: 'Columns reordered successfully' };
  }
}