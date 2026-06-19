import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { UserStatus, TaskStatus, Priority, BoardType } from '@prisma/client';
import bcrypt from 'bcrypt';

// Real bcrypt hash for 'Password123' with cost factor 4 (fast for tests).
// Generated once at module load time so all factories share the same hash.
export const MOCK_PASSWORD = 'Password123';
export const MOCK_PASSWORD_HASH = bcrypt.hashSync(MOCK_PASSWORD, 4);

export class TestFactories {
  constructor(private prisma: PrismaService) {}

  async createUser(overrides: Partial<{
    email: string;
    name: string;
    passwordHash: string;
    status: UserStatus;
    isVerified: boolean;
  }> = {}) {
    const random = Math.random().toString(36).substring(7);
    return this.prisma.user.create({
      data: {
        email: overrides.email || `user-${random}@mongez.test`,
        name: overrides.name || `Test User ${random}`,
        passwordHash: overrides.passwordHash || MOCK_PASSWORD_HASH,
        status: overrides.status || UserStatus.ACTIVE,
        isVerified: overrides.isVerified !== undefined ? overrides.isVerified : true,
      },
    });
  }

  async createSpace(overrides: Partial<{
    name: string;
    prefix: string;
  }> = {}) {
    const random = Math.random().toString(36).substring(7);
    const space = await this.prisma.space.create({
      data: {
        name: overrides.name || `Space ${random}`,
        prefix: overrides.prefix || `SP${random.substring(0, 3).toUpperCase()}`,
      },
    });

    // Create a default counter for space task identifier generation
    await this.prisma.spaceCounter.create({
      data: {
        spaceId: space.id,
        seq: 0,
      },
    });

    return space;
  }

  async createDepartment(spaceId: string, overrides: Partial<{
    name: string;
  }> = {}) {
    const random = Math.random().toString(36).substring(7);
    return this.prisma.department.create({
      data: {
        name: overrides.name || `Dept ${random}`,
        spaceId,
      },
    });
  }

  async createBoard(departmentId: string, overrides: Partial<{
    name: string;
    type: BoardType;
  }> = {}) {
    const random = Math.random().toString(36).substring(7);
    return this.prisma.board.create({
      data: {
        name: overrides.name || `Board ${random}`,
        departmentId,
        type: overrides.type || BoardType.KANBAN,
      },
    });
  }

  async createBoardColumn(boardId: string, overrides: Partial<{
    name: string;
    position: number;
    wipLimit: number;
  }> = {}) {
    const random = Math.random().toString(36).substring(7);
    return this.prisma.boardColumn.create({
      data: {
        boardId,
        name: overrides.name || `Column ${random}`,
        position: overrides.position !== undefined ? overrides.position : 0,
        wipLimit: overrides.wipLimit || null,
      },
    });
  }

  async createTask(boardId: string, createdById: string, overrides: Partial<{
    title: string;
    columnId: string;
    status: TaskStatus;
    priority: Priority;
    identifier: string;
  }> = {}) {
    const random = Math.random().toString(36).substring(7);
    
    // Generate unique identifier if not provided
    let identifier = overrides.identifier;
    if (!identifier) {
      const board = await this.prisma.board.findUnique({
        where: { id: boardId },
        include: { department: { include: { space: true } } },
      });
      const prefix = board?.department?.space?.prefix || 'TASK';
      const counter = await this.prisma.spaceCounter.update({
        where: { spaceId: board?.department?.spaceId },
        data: { seq: { increment: 1 } },
      });
      identifier = `${prefix}-${counter.seq}`;
    }

    return this.prisma.task.create({
      data: {
        identifier,
        title: overrides.title || `Task ${random}`,
        boardId,
        columnId: overrides.columnId || null,
        status: overrides.status || TaskStatus.TODO,
        priority: overrides.priority || Priority.MEDIUM,
        createdById,
      },
    });
  }

  async getOrCreateRole(name: string = 'MEMBER') {
    let role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) {
      role = await this.prisma.role.create({
        data: { name, description: `${name} role` },
      });
    }
    return role;
  }

  async createMembership(userId: string, spaceId: string, roleName: string = 'MEMBER') {
    const role = await this.getOrCreateRole(roleName);
    return this.prisma.membership.create({
      data: {
        userId,
        spaceId,
        roleId: role.id,
      },
    });
  }
}
