import { Injectable, PipeTransform } from '@nestjs/common';

/**
 * SanitizePipe — strips potentially dangerous content from all string inputs.
 *
 * Applied globally after ValidationPipe in main.ts so it runs on every request body.
 *
 * What it does:
 *   - Removes <script> tags (XSS)
 *   - Removes javascript: protocol links
 *   - Removes null bytes (SQL injection vector)
 *   - Trims whitespace
 *   - Caps string length at 10,000 characters (hard global limit)
 *   - Recursively processes nested objects and arrays
 *
 * Note: This is a first-pass defence. Domain-level validation (e.g. `@MaxLength`)
 * in DTOs provides the precise limits per field. This pipe is a safety net.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return this.sanitize(value);
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          this.sanitize(v),
        ]),
      );
    }

    return value;
  }

  private sanitizeString(input: string): string {
    return input
      // Remove script tags (XSS)
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: protocol
      .replace(/javascript\s*:/gi, '')
      // Remove vbscript: protocol
      .replace(/vbscript\s*:/gi, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Trim leading/trailing whitespace
      .trim()
      // Hard cap — no single string input should exceed 10,000 chars
      .slice(0, 10_000);
  }
}
