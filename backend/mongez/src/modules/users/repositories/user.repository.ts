import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { UserStatus } from '@prisma/client';
import { UpdateProfileDto } from '../dto/update-profile.dto';

export const SELECT_SAFE_USER = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  language: true,
  status: true,
  isVerified: true,
  provider: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: SELECT_SAFE_USER });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email }, select: SELECT_SAFE_USER });
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ skip, take: limit, select: SELECT_SAFE_USER, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count(),
    ]);
    return { data, total };
  }

  async findWithPasswordHash(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  }

  async updateProfile(id: string, data: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id }, data, select: SELECT_SAFE_USER });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({ where: { id }, data: { status }, select: SELECT_SAFE_USER });
  }

  async setVerificationToken(id: string, token: string) {
    return this.prisma.user.update({ where: { id }, data: { emailVerificationToken: token } });
  }

  async verifyEmail(token: string) {
    return this.prisma.user.update({
      where: { emailVerificationToken: token },
      data: { isVerified: true, emailVerificationToken: null, emailVerifiedAt: new Date() },
      select: SELECT_SAFE_USER,
    });
  }

  async revokeAllSessions(userId: string) {
    return this.prisma.userSession.deleteMany({ where: { userId } });
  }
}
