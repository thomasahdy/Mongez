import { Role, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';

export class User {
  private _id!: string;
  private _email!: string;
  private _password!: string;
  private _firstName?: string;
  private _lastName?: string;
  private _role!: Role;
  private _status!: UserStatus;
  private _isVerified!: boolean;
  private _failedAttempts!: number;
  private _lockedUntil?: Date;
  private _lastLoginAt?: Date;
  private _createdAt!: Date;
  private _updatedAt!: Date;

  constructor(id?: string) {
    this._id = id || crypto.randomUUID();
  }

  static create(
    email: string,
    password: string,
    role: Role = Role.MEMBER,
    firstName?: string,
    lastName?: string,
  ): User {
    const user = new User();
    user._email = email;
    user._password = password;
    user._role = role;
    user._status = UserStatus.ACTIVE;
    user._isVerified = false;
    user._failedAttempts = 0;
    user._firstName = firstName;
    user._lastName = lastName;
    user._createdAt = new Date();
    user._updatedAt = new Date();
    return user;
  }

  // ─── Getters ───

  get id(): string {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get password(): string {
    return this._password;
  }

  get firstName(): string | undefined {
    return this._firstName;
  }

  get lastName(): string | undefined {
    return this._lastName;
  }

  get role(): Role {
    return this._role;
  }

  get status(): UserStatus {
    return this._status;
  }

  get isVerified(): boolean {
    return this._isVerified;
  }

  get failedAttempts(): number {
    return this._failedAttempts;
  }

  get lockedUntil(): Date | undefined {
    return this._lockedUntil;
  }

  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isLocked(): boolean {
    return this._lockedUntil ? new Date() < this._lockedUntil : false;
  }

  get fullName(): string {
    if (this._firstName && this._lastName) {
      return `${this._firstName} ${this._lastName}`;
    }
    return this._email;
  }

  // ─── Mutations ───

  login(): void {
    this._lastLoginAt = new Date();
    this._updatedAt = new Date();
  }

  incrementFailedAttempts(): void {
    this._failedAttempts += 1;
    this._updatedAt = new Date();
  }

  resetFailedAttempts(): void {
    this._failedAttempts = 0;
    this._lockedUntil = undefined;
    this._updatedAt = new Date();
  }

  lock(durationMs: number): void {
    this._lockedUntil = new Date(Date.now() + durationMs);
    this._updatedAt = new Date();
  }

  updateProfile(data: { firstName?: string; lastName?: string }): void {
    if (data.firstName !== undefined) this._firstName = data.firstName;
    if (data.lastName !== undefined) this._lastName = data.lastName;
    this._updatedAt = new Date();
  }

  verifyEmail(): void {
    this._isVerified = true;
    this._updatedAt = new Date();
  }

  changeStatus(status: UserStatus): void {
    this._status = status;
    this._updatedAt = new Date();
  }

  changeRole(role: Role): void {
    this._role = role;
    this._updatedAt = new Date();
  }
}