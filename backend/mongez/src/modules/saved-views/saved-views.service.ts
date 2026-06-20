import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async createView(
    userId: string,
    spaceId: string,
    name: string,
    icon: string | null,
    filters: any,
    isPublic: boolean,
  ) {
    return this.prisma.savedView.upsert({
      where: {
        userId_spaceId_name: {
          userId,
          spaceId,
          name,
        },
      },
      update: {
        icon,
        filters,
        isPublic,
      },
      create: {
        userId,
        spaceId,
        name,
        icon,
        filters,
        isPublic,
      },
    });
  }

  async getViews(userId: string, spaceId: string) {
    return this.prisma.savedView.findMany({
      where: {
        spaceId,
        OR: [
          { userId },
          { isPublic: true },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteView(id: string, userId: string) {
    const view = await this.prisma.savedView.findUnique({
      where: { id },
    });

    if (!view) {
      throw new NotFoundException('Saved view not found.');
    }

    if (view.userId !== userId) {
      throw new ForbiddenException('You can only delete your own saved views.');
    }

    return this.prisma.savedView.delete({
      where: { id },
    });
  }
}
