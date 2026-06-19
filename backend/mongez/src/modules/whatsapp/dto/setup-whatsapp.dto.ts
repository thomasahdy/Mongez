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
 */
export class SetupWhatsappDto {
  @IsString()
  @MinLength(1)
  phoneNumberId: string;

  @IsString()
  @MinLength(1)
  wabaId: string;

  @IsString()
  @MinLength(1)
  accessToken: string;

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
