import {
  IsString,
  IsBoolean,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Admin payload to register / update the Meta WhatsApp Cloud API credentials
 * for the active space (`WhatsAppAccount`, 1:1 with the space).
 *
 * `wabaId` and `accessToken` are optional on updates — omit them to preserve
 * the existing encrypted values (e.g. when only toggling `isActive`).
 */
export class SetupWhatsappDto {
  @IsString()
  @MinLength(1)
  phoneNumberId: string;

  /** Meta WhatsApp Business Account ID. Optional on update to keep existing value. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  wabaId?: string;

  /** Permanent access token. Optional on update to keep the existing encrypted token. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  accessToken?: string;

  @IsString()
  @MinLength(1)
  displayName: string;

  /** App secret used to verify Meta webhook signatures. */
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
