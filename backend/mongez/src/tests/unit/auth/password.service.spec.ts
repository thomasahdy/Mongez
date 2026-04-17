import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../../../modules/auth/services/password.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('PasswordService', () => {
  let service: PasswordService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(12),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hash', () => {
    it('should hash a password using bcrypt', async () => {
      const password = 'TestPassword123';
      const hashedPassword = 'hashedPassword';
      
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hash(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should use saltOrRounds from config', async () => {
      const password = 'TestPassword123';
      const saltOrRounds = 10;
      
      configService.get = jest.fn().mockReturnValue(saltOrRounds);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');

      await service.hash(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, saltOrRounds);
    });
  });

  describe('compare', () => {
    it('should compare password with hash', async () => {
      const password = 'TestPassword123';
      const hash = 'hashedPassword';
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.compare(password, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false when passwords do not match', async () => {
      const password = 'wrongPassword';
      const hash = 'hashedPassword';
      
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.compare(password, hash);

      expect(result).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate correct password', () => {
      const validPasswords = [
        'TestPassword123',
        'AnotherPass456',
        'MySecure789',
        'ValidPass1word',
      ];

      validPasswords.forEach(password => {
        expect(service.validatePassword(password)).toBe(true);
      });
    });

    it('should reject invalid passwords', () => {
      const invalidPasswords = [
        'short', // too short
        'alllowercase123', // missing uppercase
        'ALLUPPERCASE123', // missing lowercase
        'NoNumbersHere', // missing number
        'With Spaces123', // contains spaces
        '', // empty
      ];

      invalidPasswords.forEach(password => {
        expect(service.validatePassword(password)).toBe(false);
      });
    });
  });

  describe('getPasswordRequirements', () => {
    it('should return password requirements string', () => {
      const requirements = service.getPasswordRequirements();
      
      expect(requirements).toContain('8 characters');
      expect(requirements).toContain('uppercase');
      expect(requirements).toContain('lowercase');
      expect(requirements).toContain('number');
    });
  });
});