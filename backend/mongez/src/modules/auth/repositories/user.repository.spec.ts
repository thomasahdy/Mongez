import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from './user.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { User } from '../domain/user.entity';

describe('UserRepository', () => {
  let repository: UserRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockDbUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    status: 'ACTIVE',
    isVerified: true,
    failedAttempts: 0,
    lockedUntil: null,
    provider: null,
    providerId: null,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      userSession: {
        create: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  describe('findById()', () => {
    it('UT-USER-REPO-001: should query user details and format locked status', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDbUser as any);

      const result = await repository.findById('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(result).toMatchObject({
        id: 'user-1',
        isLocked: false,
      });
    });

    it('UT-USER-REPO-002: should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('bad-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail()', () => {
    it('UT-USER-REPO-003: should return user by email and format status', async () => {
      prisma.user.findUnique.mockResolvedValue(mockDbUser as any);

      const result = await repository.findByEmail('test@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'test@example.com' } }),
      );
      expect(result?.email).toBe('test@example.com');
    });
  });

  describe('findByEmailWithPassword()', () => {
    it('UT-USER-REPO-004: should fetch user including password hash', async () => {
      const mockWithPwd = { ...mockDbUser, passwordHash: 'hash' };
      prisma.user.findUnique.mockResolvedValue(mockWithPwd as any);

      const result = await repository.findByEmailWithPassword('test@example.com');

      expect(result?.passwordHash).toBe('hash');
    });
  });

  describe('existsById() & existsByEmail()', () => {
    it('UT-USER-REPO-005: should check exists by ID', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      expect(await repository.existsById('user-1')).toBe(true);

      prisma.user.findUnique.mockResolvedValue(null);
      expect(await repository.existsById('bad-id')).toBe(false);
    });

    it('UT-USER-REPO-006: should check exists by email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      expect(await repository.existsByEmail('test@example.com')).toBe(true);
    });
  });

  describe('save()', () => {
    it('UT-USER-REPO-007: should save user by calling Prisma upsert', async () => {
      const user = User.create('test@example.com', 'pwd', 'Test User');
      prisma.user.upsert.mockResolvedValue({} as any);

      await repository.save(user);

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          create: expect.objectContaining({ email: 'test@example.com' }),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('UT-USER-REPO-008: should remove user by calling delete', async () => {
      prisma.user.delete.mockResolvedValue({} as any);

      await repository.delete('user-1');

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });

  describe('recordLogin()', () => {
    it('UT-USER-REPO-009: should record login by updating lastLoginAt timestamp', async () => {
      prisma.user.update.mockResolvedValue({} as any);

      await repository.recordLogin('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('saveRefreshToken()', () => {
    it('UT-USER-REPO-010: should save refresh token using UserSession create', async () => {
      const expiry = new Date();
      prisma.userSession.create.mockResolvedValue({} as any);

      await repository.saveRefreshToken('user-1', 'refresh-token', expiry);

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          refreshToken: 'refresh-token',
          expiresAt: expiry,
        },
      });
    });
  });
});
