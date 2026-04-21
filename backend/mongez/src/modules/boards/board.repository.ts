import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class BoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.board.findUnique({
      where: { id },
      include: {
        columns: { orderBy: { position: 'asc' } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async findByDepartmentId(departmentId: string) {
    return this.prisma.board.findMany({
      where: { departmentId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        _count: { select: { tasks: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: any) {
    return this.prisma.board.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.board.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.board.delete({ where: { id } });
  }
}