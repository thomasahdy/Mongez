import { Test, TestingModule } from '@nestjs/testing';
import { AICircuitBreakerService } from './ai-circuit-breaker.service';

describe('AICircuitBreakerService', () => {
  let service: AICircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AICircuitBreakerService],
    }).compile();

    service = module.get<AICircuitBreakerService>(AICircuitBreakerService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service.getState()).toBe('CLOSED');
  });

  it('should return result on successful call and keep circuit closed', async () => {
    const fn = jest.fn().mockResolvedValue('success-data');
    const result = await service.call(fn);

    expect(result).toBe('success-data');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(service.getState()).toBe('CLOSED');
  });

  it('should trip to OPEN after 3 consecutive failures', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('service failure'));

    // 1st failure
    await expect(service.call(fn)).rejects.toThrow('service failure');
    expect(service.getState()).toBe('CLOSED');

    // 2nd failure
    await expect(service.call(fn)).rejects.toThrow('service failure');
    expect(service.getState()).toBe('CLOSED');

    // 3rd failure - trips
    await expect(service.call(fn)).rejects.toThrow('service failure');
    expect(service.getState()).toBe('OPEN');
  });

  it('should return fallback response when OPEN', async () => {
    // Force OPEN state by triggering 3 failures
    const fnFailed = jest.fn().mockRejectedValue(new Error('failure'));
    for (let i = 0; i < 3; i++) {
      await expect(service.call(fnFailed)).rejects.toThrow('failure');
    }
    expect(service.getState()).toBe('OPEN');

    // Make call - should bypass fn and return fallback
    const fn = jest.fn().mockResolvedValue('should not run');
    const result = await service.call(fn);

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect((result as any).degraded).toBe(true);
    expect((result as any).response).toContain('temporarily unavailable');
  });

  it('should transition to HALF_OPEN after cooldown period', async () => {
    // Trip to OPEN
    const fnFailed = jest.fn().mockRejectedValue(new Error('failure'));
    for (let i = 0; i < 3; i++) {
      await expect(service.call(fnFailed)).rejects.toThrow('failure');
    }
    expect(service.getState()).toBe('OPEN');

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    // Call checkState implicitly by executing call
    const fnSuccess = jest.fn().mockResolvedValue('recovered');
    const result = await service.call(fnSuccess);

    expect(result).toBe('recovered');
    // First call in HALF_OPEN succeeded, so it should close the circuit
    expect(service.getState()).toBe('CLOSED');
  });

  it('should trip back to OPEN if call fails in HALF_OPEN', async () => {
    // Trip to OPEN
    const fnFailed = jest.fn().mockRejectedValue(new Error('failure'));
    for (let i = 0; i < 3; i++) {
      await expect(service.call(fnFailed)).rejects.toThrow('failure');
    }
    expect(service.getState()).toBe('OPEN');

    // Fast-forward 30 seconds to HALF_OPEN
    jest.advanceTimersByTime(30000);

    // Call failed in HALF_OPEN
    const fnFailedAgain = jest.fn().mockRejectedValue(new Error('half open failure'));
    await expect(service.call(fnFailedAgain)).rejects.toThrow('half open failure');

    // Should immediately trip back to OPEN without waiting for 3 failures
    expect(service.getState()).toBe('OPEN');
  });
});
