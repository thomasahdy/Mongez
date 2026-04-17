import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { BoardRepository } from './board.repository';

@Injectable()
export class BoardsService {
  private readonly CACHE_PREFIX = 'board';
  private readonly CACHE_TTL = 120;

  constructor(
    private readonly boardRepo: BoardRepository,
    private readonly cache: CacheService,
  ) {}

  async getBoardById(id: string) {
    return this.cache.getOrSet(
      `${this.CACHE_PREFIX}:${id}`,
      async () => {
        const board = await this.boardRepo.findById(id);
        if (!board) throw new NotFoundException('Board not found');
        return board;
      },
      this.CACHE_TTL,
    );
  }

  async getSpaceBoards(spaceId: string) {
    return this.cache.getOrSet(
      `space:${spaceId}:boards`,
      () => this.boardRepo.findBySpaceId(spaceId),
      this.CACHE_TTL,
    );
  }

  async createBoard(data: any) {
    const board = await this.boardRepo.create(data);
    await this.cache.invalidateEntityType(this.CACHE_PREFIX);
    return board;
  }

  async updateBoard(id: string, data: any) {
    const board = await this.boardRepo.update(id, data);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
    return board;
  }

  async deleteBoard(id: string) {
    await this.boardRepo.delete(id);
    await this.cache.invalidateEntity(this.CACHE_PREFIX, id);
  }
}