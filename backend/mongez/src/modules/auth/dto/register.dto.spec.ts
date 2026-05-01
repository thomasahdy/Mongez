import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const getErrors = async (obj: Partial<RegisterDto>) => {
    const dto = plainToInstance(RegisterDto, obj);
    return validate(dto);
  };

  it('UT-DTO-001: should accept valid registration data', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'Password123',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('UT-DTO-002: should reject invalid email', async () => {
    const errors = await getErrors({ email: 'notanemail', password: 'Password123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('UT-DTO-003: should reject missing email', async () => {
    const errors = await getErrors({ password: 'Password123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('UT-DTO-004: should reject missing password', async () => {
    const errors = await getErrors({ email: 'user@example.com' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('UT-DTO-005: should reject weak password (no uppercase)', async () => {
    const errors = await getErrors({ email: 'user@example.com', password: 'password123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('should reject password with less than 8 characters', async () => {
    const errors = await getErrors({ email: 'user@example.com', password: 'Pass1' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('should reject password with no lowercase', async () => {
    const errors = await getErrors({ email: 'user@example.com', password: 'PASSWORD123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('should reject password with no digit', async () => {
    const errors = await getErrors({ email: 'user@example.com', password: 'PasswordABC' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('should reject empty body', async () => {
    const errors = await getErrors({});

    expect(errors).toHaveLength(2);
  });
});