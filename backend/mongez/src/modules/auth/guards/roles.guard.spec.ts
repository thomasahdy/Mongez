import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
    } as any;
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
    } as any;
  };

  it('UT-GRD-005: should allow request when user has required role', () => {
    reflector.get.mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('UT-GRD-006: should block request when user lacks required role', () => {
    reflector.get.mockReturnValue(['ADMIN']);
    const context = createMockContext({ role: 'MEMBER' });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('UT-GRD-007: should allow request when no @Roles() decorator', () => {
    reflector.get.mockReturnValue(null);
    const context = createMockContext({ role: 'MEMBER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow when user has one of multiple required roles', () => {
    reflector.get.mockReturnValue(['ADMIN', 'HEAD']);
    const context = createMockContext({ role: 'HEAD' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should block when user has no role', () => {
    reflector.get.mockReturnValue(['ADMIN']);
    const context = createMockContext({});

    expect(guard.canActivate(context)).toBe(false);
  });
});