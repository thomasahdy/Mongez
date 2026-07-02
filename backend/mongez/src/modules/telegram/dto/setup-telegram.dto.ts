import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

/**
 * Admin payload to register / update the Telegram Bot credentials for the
 * active space (`TelegramAccount`, 1:1 with the space).
 *
 * `botToken` and `botUsername` are optional on updates — omit them to preserve
 * the existing encrypted values (e.g. when only toggling `isActive`).
 */
export class SetupTelegramDto {
  /** Bot API token from BotFather. Optional on update to keep the existing encrypted token. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  botToken?: string;

  /** Bot username without the leading `@`. Optional on update. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  botUsername?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
