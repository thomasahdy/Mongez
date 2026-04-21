import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { User } from '../domain/user.entity';

export interface UserReadModel {
  id: string;
  email: string;
  name: string;
  status: string;
  isVerified: boolean;
  failedAttempts: number;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithPassword extends UserReadModel {
  passwordHash: string;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── READ OPERATIONS ───

  async findById(id: string): Promise<UserReadModel | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isVerified: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      status: user.status as string,
      isLocked: user.lockedUntil ? new Date() < user.lockedUntil : false,
    };
  }

  async findByEmail(email: string): Promise<UserReadModel | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        isVerified: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      status: user.status as string,
      isLocked: user.lockedUntil ? new Date() < user.lockedUntil : false,
    };
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        status: true,
        isVerified: true,
        failedAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      status: user.status as string,
      isLocked: user.lockedUntil ? new Date() < user.lockedUntil : false,
    };
  }

  async existsById(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!user;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !!user;
  }

  // ─── WRITE OPERATIONS ───

  async save(user: User): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        passwordHash: user.password,
        name: user.name,
        status: user.status,
        isVerified: user.isVerified,
        failedAttempts: user.failedAttempts,
        lockedUntil: user.lockedUntil ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        updatedAt: new Date(),
      },
      create: {
        id: user.id,
        email: user.email,
        passwordHash: user.password,
        name: user.name,
        status: user.status,
        isVerified: user.isVerified,
        failedAttempts: user.failedAttempts,
        lockedUntil: user.lockedUntil ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async recordLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  async saveRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken,
        expiresAt,
      },
    });
  }
}