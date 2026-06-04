import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateBoardDto, UpdateBoardDto, CreateColumnDto, UpdateColumnDto, ReorderColumnsDto } from '../dto/boards.dto';

@Injectable()
export class BoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly BOARD_INCLUDE = {
    columns: { orderBy: { position: 'asc' as const } },
    _count: { select: { tasks: true } },
    department: { select: { id: true, name: true, spaceId: true } },
  };

  async findById(id: string) {
    return this.prisma.board.findUnique({ where: { id }, include: this.BOARD_INCLUDE });
  }

  async findByDepartment(departmentId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { departmentId, isArchived: false };
    const [data, total] = await Promise.all([
      this.prisma.board.findMany({ where, skip, take: limit, include: this.BOARD_INCLUDE, orderBy: { createdAt: 'asc' } }),
      this.prisma.board.count({ where }),
    ]);
    return { data, total };
  }

  async create(dto: CreateBoardDto) {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: { name: dto.name, type: dto.type, departmentId: dto.departmentId },
      });

      // Auto-create 4 standard columns
      await tx.boardColumn.createMany({
        data: [
          { name: 'To Do',       color: '#94A3B8', position: 0, boardId: board.id },
          { name: 'In Progress', color: '#3B82F6', position: 1, boardId: board.id },
          { name: 'In Review',   color: '#F59E0B', position: 2, boardId: board.id },
          { name: 'Done',        color: '#22C55E', position: 3, boardId: board.id },
        ],
      });

      return tx.board.findUnique({
        where: { id: board.id },
        include: this.BOARD_INCLUDE,
      });
    });
  }

  async update(id: string, dto: UpdateBoardDto) {
    return this.prisma.board.update({ where: { id }, data: dto, include: this.BOARD_INCLUDE });
  }

  async archive(id: string) {
    return this.prisma.board.update({ where: { id }, data: { isArchived: true } });
  }
}

@Injectable()
export class ColumnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(boardId: string, dto: CreateColumnDto) {
    const last = await this.prisma.boardColumn.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = dto.position ?? (last !== null ? last!.position + 1 : 0);
    return this.prisma.boardColumn.create({
      data: { name: dto.name, color: dto.color, wipLimit: dto.wipLimit, boardId, position },
    });
  }

  async update(id: string, dto: UpdateColumnDto) {
    return this.prisma.boardColumn.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const taskCount = await this.prisma.task.count({ where: { columnId: id, isArchived: false } });
    if (taskCount > 0) {
      throw new BadRequestException(
        `Cannot delete column: it contains ${taskCount} active tasks. Move or archive tasks first.`,
      );
    }
    return this.prisma.boardColumn.delete({ where: { id } });
  }

  async reorder(boardId: string, dto: ReorderColumnsDto) {
    return this.prisma.$transaction(
      dto.columns.map((col) =>
        this.prisma.boardColumn.update({
          where: { id: col.id },
          data: { position: col.position },
        }),
      ),
    );
  }
}
