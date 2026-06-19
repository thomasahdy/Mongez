import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import { SearchOptionsDto } from './dto/search-options.dto';

export interface SearchResult {
  tasks: any[];
  approvals: any[];
  files: any[];
  comments: any[];
  total: number;
}

export interface SuggestionResult {
  text: string;
  type: string;
  id: string;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Unified global search across multiple entity types, scoped to a tenant.
   */
  async globalSearch(userId: string, options: SearchOptionsDto): Promise<SearchResult> {
    const { q, spaceId, types = ['task', 'approval', 'file', 'comment'] } = options;

    const [tasks, approvals, files, comments] = await Promise.all([
      types.includes('task') ? this.searchTasks(q, spaceId, options) : Promise.resolve([]),
      types.includes('approval')
        ? this.searchApprovals(q, spaceId, options)
        : Promise.resolve([]),
      types.includes('file') ? this.searchFiles(q, spaceId, options) : Promise.resolve([]),
      types.includes('comment') ? this.searchComments(q, spaceId, options) : Promise.resolve([]),
    ]);

    return {
      tasks,
      approvals,
      files,
      comments,
      total: tasks.length + approvals.length + files.length + comments.length,
    };
  }

  /**
   * Task search uses the existing tsvector `searchVector` column + GIN index
   * with a fallback to ILIKE for short queries.
   */
  async searchTasks(query: string, spaceId: string, options: SearchOptionsDto): Promise<any[]> {
    const limit = Number(options.limit ?? 20);
    const offset = (Number(options.page ?? 1) - 1) * limit;

    // Raw SQL for FTS (tsvector column is Unsupported in Prisma client)
    const tasks = await this.prisma.$queryRaw<any[]>`
      SELECT t.id, t.identifier, t.title, t.status, t.priority, t."dueDate",
             ts_rank(t."searchVector", plainto_tsquery(${query})) AS rank
      FROM "tasks" t
      JOIN "boards" b ON t."boardId" = b.id
      JOIN "departments" d ON b."departmentId" = d.id
      WHERE d."spaceId" = ${spaceId}
        AND t."searchVector" @@ plainto_tsquery(${query})
        AND t."isArchived" = false
        ${options.assigneeId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "task_assignments" ta WHERE ta."taskId" = t.id AND ta."userId" = ${options.assigneeId})` : Prisma.empty}
        ${options.status ? Prisma.sql`AND t.status = ${options.status}::\"TaskStatus\"` : Prisma.empty}
        ${options.overdue ? Prisma.sql`AND t."dueDate" < NOW() AND t.status NOT IN ('DONE','CANCELLED')` : Prisma.empty}
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Fallback to ILIKE when FTS returns nothing (short/typo queries)
    if (!tasks.length) {
      return this.prisma.task.findMany({
        where: {
          board: { department: { spaceId } },
          isArchived: false,
          ...(options.status && { status: options.status as any }),
          ...(options.assigneeId && { assignments: { some: { userId: options.assigneeId } } }),
          ...(options.overdue && {
            dueDate: { lt: new Date() },
            status: { notIn: ['DONE', 'CANCELLED'] },
          }),
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          identifier: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' },
      });
    }

    return tasks;
  }

  /**
   * Search workflow instances / approvals by requester, reviewer, entity, or context.
   */
  async searchApprovals(query: string, spaceId: string, options: SearchOptionsDto): Promise<any[]> {
    const limit = Number(options.limit ?? 20);
    const offset = (Number(options.page ?? 1) - 1) * limit;

    return this.prisma.workflowInstance.findMany({
      where: {
        spaceId,
        ...(options.status && { status: options.status }),
        OR: [
          { definition: { name: { contains: query, mode: 'insensitive' } } },
          { requester: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        status: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        resolvedAt: true,
        definition: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true, avatarUrl: true } },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Search file attachments by file name.
   */
  async searchFiles(query: string, spaceId: string, options: SearchOptionsDto): Promise<any[]> {
    const limit = Number(options.limit ?? 20);
    const offset = (Number(options.page ?? 1) - 1) * limit;

    return this.prisma.attachment.findMany({
      where: {
        task: { board: { department: { spaceId } } },
        fileName: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        createdAt: true,
        task: { select: { id: true, identifier: true, title: true } },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Search comments by content (excluding soft-deleted).
   */
  async searchComments(query: string, spaceId: string, options: SearchOptionsDto): Promise<any[]> {
    const limit = Number(options.limit ?? 20);
    const offset = (Number(options.page ?? 1) - 1) * limit;

    return this.prisma.comment.findMany({
      where: {
        task: { board: { department: { spaceId } } },
        deletedAt: null,
        content: { contains: query, mode: 'insensitive' },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, name: true, avatarUrl: true } },
        task: { select: { id: true, identifier: true, title: true } },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Autocomplete suggestions across entities.
   */
  async suggestions(query: string, spaceId: string): Promise<SuggestionResult[]> {
    if (!query || query.trim().length < 2) return [];

    const [tasks, files] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          board: { department: { spaceId } },
          isArchived: false,
          title: { startsWith: query, mode: 'insensitive' },
        },
        select: { id: true, title: true },
        take: 5,
      }),
      this.prisma.attachment.findMany({
        where: {
          task: { board: { department: { spaceId } } },
          fileName: { startsWith: query, mode: 'insensitive' },
        },
        select: { id: true, fileName: true },
        take: 5,
      }),
    ]);

    return [
      ...tasks.map((t) => ({ id: t.id, text: t.title, type: 'task' })),
      ...files.map((f) => ({ id: f.id, text: f.fileName, type: 'file' })),
    ];
  }

  /**
   * Available filter facets for a space — helps the UI render dynamic filters.
   */
  async getFilters(spaceId: string) {
    const [assignees, statuses] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          memberships: { some: { spaceId } },
          assignedTasks: { some: { task: { board: { department: { spaceId } } } } },
        },
        select: { id: true, name: true, avatarUrl: true },
        take: 50,
      }),
      this.prisma.task.findMany({
        where: { board: { department: { spaceId } } },
        distinct: ['status'],
        select: { status: true },
      }),
    ]);

    return {
      assignees,
      statuses: statuses.map((s) => s.status),
      types: ['task', 'approval', 'file', 'comment'],
    };
  }
}