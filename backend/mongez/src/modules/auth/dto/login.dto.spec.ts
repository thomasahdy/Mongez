import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  const getErrors = async (obj: Partial<LoginDto>) => {
    const dto = plainToInstance(LoginDto, obj);
    return validate(dto);
  };

  it('UT-DTO-006: should accept valid login data', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: 'Password123',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('UT-DTO-007: should reject empty email', async () => {
    const errors = await getErrors({ password: 'Password123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('UT-DTO-008: should reject empty password', async () => {
    const errors = await getErrors({ email: 'user@example.com' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('should reject invalid email format', async () => {
    const errors = await getErrors({ email: 'notanemail', password: 'Password123' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('email');
  });

  it('should reject empty body', async () => {
    const errors = await getErrors({});

    expect(errors).toHaveLength(2);
  });
});