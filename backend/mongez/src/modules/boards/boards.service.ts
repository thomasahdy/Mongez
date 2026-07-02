import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { BoardRepository, ColumnRepository } from './repositories/boards.repositories';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { TrashService } from '../trash/trash.service';
import { SpaceAccessService } from '../../common/services/space-access.service';
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
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly trashService: TrashService,
    private readonly spaceAccess: SpaceAccessService,
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

  async getByDepartment(departmentId: string, page: number, limit: number, userId?: string) {
    // Tenant isolation: resolve the department's space and verify membership.
    if (userId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { spaceId: true },
      });
      if (!dept) {
        throw new NotFoundException('Department not found');
      }
      await this.spaceAccess.assertMember(userId, dept.spaceId);
    }
    const { data, total } = await this.boardRepo.findByDepartment(departmentId, page, limit);
    return paginate(data, total, page, limit);
  }

  async create(dto: CreateBoardDto) {
    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
      select: { spaceId: true },
    });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    const { limits } = await this.subscriptions.getPlan(dept.spaceId);
    const boardCount = await this.prisma.board.count({
      where: { department: { spaceId: dept.spaceId }, isArchived: false },
    });

    if (boardCount >= limits.maxBoards) {
      throw new ForbiddenException(
        `Your plan allows a maximum of ${limits.maxBoards} boards. Please upgrade.`,
      );
    }

    const board = await this.boardRepo.create(dto);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return board;
  }

  async update(id: string, dto: UpdateBoardDto) {
    const board = await this.boardRepo.update(id, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return board;
  }

  async archive(id: string, userId: string): Promise<void> {
    await this.trashService.softDeleteBoard(id, userId);
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

  async deleteColumn(boardId: string, colId: string, userId: string): Promise<void> {
    await this.trashService.softDeleteColumn(colId, userId);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, boardId);
  }

  async reorderColumns(boardId: string, dto: ReorderColumnsDto) {
    await this.columnRepo.reorder(boardId, dto);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, boardId);
    return { message: 'Columns reordered successfully' };
  }
}