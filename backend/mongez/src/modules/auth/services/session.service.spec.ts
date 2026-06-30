import { SessionService } from './session.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      userSession: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    service = new SessionService(prisma as PrismaService);
  });

  // ═══════════════════════════════════════════════════════════════
  // canCreateSession
  // ═══════════════════════════════════════════════════════════════

  describe('canCreateSession()', () => {
    it('UT-SESS-CAN-001: should return true when under session limit', async () => {
      prisma.userSession.count.mockResolvedValue(3);

      const result = await service.canCreateSession('user-123');

      expect(result).toBe(true);
      expect(prisma.userSession.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('UT-SESS-CAN-002: should return false when at session limit (5)', async () => {
      prisma.userSession.count.mockResolvedValue(5);

      const result = await service.canCreateSession('user-123');

      expect(result).toBe(false);
    });

    it('UT-SESS-CAN-003: should return true when at 4 sessions (limit is 5)', async () => {
      prisma.userSession.count.mockResolvedValue(4);

      const result = await service.canCreateSession('user-123');

      expect(result).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // createSession
  // ═══════════════════════════════════════════════════════════════

  describe('createSession()', () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('UT-SESS-CREATE-001: should create session when under limit', async () => {
      prisma.userSession.count.mockResolvedValue(3);

      await service.createSession('user-123', 'token-abc', expiresAt);

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          refreshToken: 'token-abc',
          expiresAt,
          ip: undefined,
          userAgent: undefined,
        },
      });
    });

    it('UT-SESS-CREATE-002: should remove oldest session when at limit', async () => {
      prisma.userSession.count.mockResolvedValue(5);
      prisma.userSession.findFirst.mockResolvedValue({
        id: 'oldest-session',
        createdAt: new Date('2026-01-01'),
      });

      await service.createSession('user-123', 'token-new', expiresAt);

      // Should delete oldest first, then create new
      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: 'oldest-session' },
      });
      expect(prisma.userSession.create).toHaveBeenCalled();
    });

    it('UT-SESS-CREATE-003: should store IP and userAgent metadata', async () => {
      prisma.userSession.count.mockResolvedValue(0);

      await service.createSession('user-123', 'token-abc', expiresAt, {
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      });

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
        }),
      });
    });

    it('UT-SESS-CREATE-004: should handle missing metadata gracefully', async () => {
      prisma.userSession.count.mockResolvedValue(0);

      await service.createSession('user-123', 'token-abc', expiresAt);

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ip: undefined,
          userAgent: undefined,
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // revokeOtherSessions
  // ═══════════════════════════════════════════════════════════════

  describe('revokeOtherSessions()', () => {
    it('UT-SESS-REVOKE-001: should delete all sessions except current', async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 4 });

      const result = await service.revokeOtherSessions(
        'user-123',
        'current-session',
      );

      expect(result).toBe(4);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          id: { not: 'current-session' },
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('UT-SESS-REVOKE-002: should return 0 when no other sessions exist', async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.revokeOtherSessions(
        'user-123',
        'only-session',
      );

      expect(result).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // revokeAllSessions
  // ═══════════════════════════════════════════════════════════════

  describe('revokeAllSessions()', () => {
    it('UT-SESS-REVOKEALL-001: should delete all sessions for user', async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.revokeAllSessions('user-123');

      expect(result).toBe(5);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getUserSessions
  // ═══════════════════════════════════════════════════════════════

  describe('getUserSessions()', () => {
    it('UT-SESS-GET-001: should return active sessions ordered by createdAt desc', async () => {
      const mockSessions = [
        { id: 's2', createdAt: new Date('2026-06-20'), ip: '10.0.0.2' },
        { id: 's1', createdAt: new Date('2026-06-19'), ip: '10.0.0.1' },
      ];
      prisma.userSession.findMany.mockResolvedValue(mockSessions);

      const result = await service.getUserSessions('user-123');

      expect(result).toEqual([
        { id: 's2', createdAt: new Date('2026-06-20'), ip: 'Private network' },
        { id: 's1', createdAt: new Date('2026-06-19'), ip: 'Private network' },
      ]);
      expect(prisma.userSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          ip: true,
          userAgent: true,
        },
      });
    });

    it('UT-SESS-GET-002: should only return active (non-expired) sessions', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);

      await service.getUserSessions('user-123');

      const whereClause = prisma.userSession.findMany.mock.calls[0][0].where;
      expect(whereClause.expiresAt.gt).toBeInstanceOf(Date);
      expect(whereClause.expiresAt.gt.getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // validateSession
  // ═══════════════════════════════════════════════════════════════

  describe('validateSession()', () => {
    it('UT-SESS-VALIDATE-001: should return true for valid unexpired session', async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'token-abc',
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.validateSession('session-1', 'token-abc');

      expect(result).toBe(true);
    });

    it('UT-SESS-VALIDATE-002: should return false for non-existent session', async () => {
      prisma.userSession.findUnique.mockResolvedValue(null);

      const result = await service.validateSession(
        'non-existent',
        'token-abc',
      );

      expect(result).toBe(false);
    });

    it('UT-SESS-VALIDATE-003: should return false for expired session', async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'token-abc',
        expiresAt: new Date(Date.now() - 1000), // Already expired
      });

      const result = await service.validateSession('session-1', 'token-abc');

      expect(result).toBe(false);
    });

    it('UT-SESS-VALIDATE-004: should return false for mismatched refresh token', async () => {
      prisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        refreshToken: 'token-abc',
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.validateSession(
        'session-1',
        'wrong-token',
      );

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // cleanupExpiredSessions
  // ═══════════════════════════════════════════════════════════════

  describe('cleanupExpiredSessions()', () => {
    it('UT-SESS-CLEANUP-001: should delete all expired sessions', async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 42 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(42);
      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('UT-SESS-CLEANUP-002: should return 0 when no expired sessions exist', async () => {
      prisma.userSession.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupExpiredSessions();

      expect(result).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getSessionCount
  // ═══════════════════════════════════════════════════════════════

  describe('getSessionCount()', () => {
    it('UT-SESS-COUNT-001: should return count of active sessions', async () => {
      prisma.userSession.count.mockResolvedValue(3);

      const result = await service.getSessionCount('user-123');

      expect(result).toBe(3);
    });
  });
});
