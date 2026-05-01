import { UserStatus } from '@prisma/client';
import * as crypto from 'crypto';

export class User {
  private _id!: string;
  private _email!: string;
  private _password?: string;
  private _provider?: string;
  private _providerId?: string;
  private _name!: string;
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
    name: string = '',
  ): User {
    const user = new User();
    user._email = email;
    user._password = password;
    user._name = name;
    user._status = UserStatus.ACTIVE;
    user._isVerified = false;
    user._failedAttempts = 0;
    user._createdAt = new Date();
    user._updatedAt = new Date();
    return user;
  }

  static createOAuthUser(
    email: string,
    name: string,
    provider: string,
    providerId: string,
    avatarUrl?: string
  ): User {
    const user = new User();
    user._email = email;
    user._name = name;
    user._provider = provider;
    user._providerId = providerId;
    if (avatarUrl) user.updateAvatar(avatarUrl);
    user._status = UserStatus.ACTIVE;
    user._isVerified = true; // OAuth emails are trusted
    user._failedAttempts = 0;
    user._createdAt = new Date();
    user._updatedAt = new Date();
    return user;
  }

  private _avatarUrl?: string;

  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }

  updateAvatar(url: string): void {
    this._avatarUrl = url;
    this._updatedAt = new Date();
  }

  // ─── Getters ───

  get id(): string {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get password(): string | undefined {
    return this._password;
  }

  get provider(): string | undefined {
    return this._provider;
  }

  get providerId(): string | undefined {
    return this._providerId;
  }

  get name(): string {
    return this._name;
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

  updateName(name: string): void {
    this._name = name;
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
}