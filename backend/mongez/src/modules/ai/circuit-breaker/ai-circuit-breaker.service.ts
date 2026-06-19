import { Injectable, Logger } from '@nestjs/common';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class AICircuitBreakerService {
  private readonly logger = new Logger(AICircuitBreakerService.name);

  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private readonly failureThreshold = 3;
  private readonly cooldownMs = 30000; // 30 seconds cooldown
  private lastStateChanged: number = Date.now();

  async call<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    if (this.state === 'OPEN') {
      this.logger.warn('AI circuit is OPEN — degraded mode. Returning fallback response.');
      // Return a degraded/fallback response structure matching what's expected
      return {
        degraded: true,
        response: 'AI is temporarily unavailable. Please try again in a minute.',
        intent: 'chat',
        metadata: {
          model: 'fallback',
          tokens_in: 0,
          tokens_out: 0,
        },
      } as unknown as T;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private checkState() {
    if (this.state === 'OPEN') {
      const timeSinceLastChange = Date.now() - this.lastStateChanged;
      if (timeSinceLastChange >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.lastStateChanged = Date.now();
        this.logger.log('AI circuit transitioned to HALF-OPEN — testing service connectivity.');
      }
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.logger.log('AI circuit transitioned to CLOSED — normal operations restored.');
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastStateChanged = Date.now();
  }

  private onFailure(error: any) {
    this.failureCount++;
    this.logger.warn(
      `AI service call failed. Failure count: ${this.failureCount}/${this.failureThreshold}. Error: ${error.message}`,
    );

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.lastStateChanged = Date.now();
      this.logger.error('AI circuit tripped to OPEN — entering degraded mode.');
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  // Helper for testing
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastStateChanged = Date.now();
  }
}
