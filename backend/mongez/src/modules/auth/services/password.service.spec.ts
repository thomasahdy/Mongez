import { PasswordService } from './password.service';
import { ConfigService } from '@nestjs/config';

describe('PasswordService', () => {
  let service: PasswordService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'auth.bcrypt.saltOrRounds') return 4; // Low rounds for fast tests
        return undefined;
      }),
    } as any;
    service = new PasswordService(configService);
  });

  describe('hash()', () => {
    it('UT-PWD-001: should produce a bcrypt hash', async () => {
      const hash = await service.hash('Password123');

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^\$2[aby]?\$/);
    });

    it('should produce different hashes for same password (salt)', async () => {
      const hash1 = await service.hash('Password123');
      const hash2 = await service.hash('Password123');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('compare()', () => {
    it('UT-PWD-002: should return true for correct password', async () => {
      const hash = await service.hash('Password123');
      const result = await service.compare('Password123', hash);

      expect(result).toBe(true);
    });

    it('UT-PWD-003: should return false for wrong password', async () => {
      const hash = await service.hash('Password123');
      const result = await service.compare('WrongPassword', hash);

      expect(result).toBe(false);
    });
  });

  describe('validatePassword()', () => {
    it('UT-PWD-008: should accept valid password with upper, lower, and digit', () => {
      expect(service.validatePassword('Password123')).toBe(true);
    });

    it('UT-PWD-004: should reject password with less than 8 characters', () => {
      expect(service.validatePassword('Pass1')).toBe(false);
    });

    it('UT-PWD-005: should reject password with no uppercase letter', () => {
      expect(service.validatePassword('password123')).toBe(false);
    });

    it('UT-PWD-006: should reject password with no lowercase letter', () => {
      expect(service.validatePassword('PASSWORD123')).toBe(false);
    });

    it('UT-PWD-007: should reject password with no digit', () => {
      expect(service.validatePassword('PasswordABC')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(service.validatePassword('')).toBe(false);
    });

    it('should accept password with exactly 8 characters meeting all criteria', () => {
      expect(service.validatePassword('Abcdef12')).toBe(true);
    });

    it('should reject password with whitespace', () => {
      expect(service.validatePassword('Pass word1')).toBe(false);
    });
  });

  describe('getPasswordRequirements()', () => {
    it('should return a descriptive string', () => {
      const requirements = service.getPasswordRequirements();

      expect(requirements).toContain('8 characters');
      expect(requirements).toContain('uppercase');
      expect(requirements).toContain('lowercase');
      expect(requirements).toContain('number');
    });
  });
});