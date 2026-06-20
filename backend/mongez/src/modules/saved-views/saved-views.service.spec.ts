import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SavedViewsService } from './saved-views.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('SavedViewsService', () => {
  let service: SavedViewsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      savedView: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    } as any;

    service = new SavedViewsService(prisma);
  });

  describe('createView()', () => {
    it('should upsert a saved view configuration', async () => {
      const mockResult = { id: 'view-1', name: 'My View' };
      prisma.savedView.upsert.mockResolvedValue(mockResult as any);

      const result = await service.createView('user-1', 'space-1', 'My View', 'fa-star', { status: 'TODO' }, true);

      expect(prisma.savedView.upsert).toHaveBeenCalledWith({
        where: {
          userId_spaceId_name: {
            userId: 'user-1',
            spaceId: 'space-1',
            name: 'My View',
          },
        },
        update: {
          icon: 'fa-star',
          filters: { status: 'TODO' },
          isPublic: true,
        },
        create: {
          userId: 'user-1',
          spaceId: 'space-1',
          name: 'My View',
          icon: 'fa-star',
          filters: { status: 'TODO' },
          isPublic: true,
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getViews()', () => {
    it('should fetch saved views belonging to the user or public views in the space', async () => {
      const mockList = [{ id: 'view-1' }];
      prisma.savedView.findMany.mockResolvedValue(mockList as any);

      const result = await service.getViews('user-1', 'space-1');

      expect(prisma.savedView.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-1',
          OR: [
            { userId: 'user-1' },
            { isPublic: true },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('deleteView()', () => {
    it('should throw NotFoundException if saved view does not exist', async () => {
      prisma.savedView.findUnique.mockResolvedValue(null);

      await expect(service.deleteView('view-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner of the saved view', async () => {
      prisma.savedView.findUnique.mockResolvedValue({ id: 'view-1', userId: 'user-2' } as any);

      await expect(service.deleteView('view-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should delete the saved view if it exists and belongs to the user', async () => {
      prisma.savedView.findUnique.mockResolvedValue({ id: 'view-1', userId: 'user-1' } as any);
      prisma.savedView.delete.mockResolvedValue({ id: 'view-1' } as any);

      const result = await service.deleteView('view-1', 'user-1');

      expect(prisma.savedView.delete).toHaveBeenCalledWith({
        where: { id: 'view-1' },
      });
      expect(result).toEqual({ id: 'view-1' });
    });
  });
});
