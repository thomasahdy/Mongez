import { IsString, IsOptional, Matches } from 'class-validator';

/**
 * Links the authenticated Mongez user to a WhatsApp phone number for the active
 * space, creating / updating their `WhatsAppContact`.
 *
 * `phoneNumber` must be E.164 (e.g. +9665XXXXXXXX). `waId` is optional — it is
 * normally populated from inbound messages, but can be supplied upfront.
 */
export class RegisterContactDto {
  /** E.164 phone number, e.g. +9665XXXXXXXX. */
  @IsString()
  @Matches(/^\+\d{6,15}$/, {
    message: 'phoneNumber must be in E.164 format (e.g. +9665XXXXXXXX)',
  })
  phoneNumber: string;

  @IsOptional()
  @IsString()
  waId?: string;
}
