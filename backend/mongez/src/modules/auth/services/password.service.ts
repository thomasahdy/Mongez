import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Hash a password using bcrypt
   * @param password The plain text password to hash
   * @returns Promise<string> The hashed password
   */
  async hash(password: string): Promise<string> {
    const saltOrRounds = this.configService.get<number>('auth.bcrypt.saltOrRounds') || 10;
    return bcrypt.hash(password, saltOrRounds);
  }

  /**
   * Compare a plain text password with a hashed password
   * @param password The plain text password
   * @param hash The hashed password
   * @returns Promise<boolean> True if passwords match
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password complexity requirements
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * @param password The password to validate
   * @returns boolean True if password meets requirements
   */
  validatePassword(password: string): boolean {
    // Moderate complexity: 8+ characters, uppercase, lowercase, number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{8,}$/;
    return regex.test(password);
  }

  /**
   * Get password requirements as a string for error messages
   * @returns string Description of password requirements
   */
  getPasswordRequirements(): string {
    return 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, and one number';
  }
}