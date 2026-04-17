import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.space.findUnique({
      where: { id },
      include: {
        _count: { select: { boards: true, members: true } },
      },
    });
  }

  async findAll(page = 1, limit = 20) {
    const [spaces, total] = await Promise.all([
      this.prisma.space.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { boards: true, members: true } },
        },
      }),
      this.prisma.space.count(),
    ]);
    return { spaces, total, page, limit };
  }

  async create(data: any) { return this.prisma.space.create({ data }); }
  async update(id: string, data: any) { return this.prisma.space.update({ where: { id }, data }); }
  async delete(id: string) { return this.prisma.space.delete({ where: { id } }); }
}