import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

/**
 * Admin payload to register / update the Telegram Bot credentials for the
 * active space (`TelegramAccount`, 1:1 with the space).
 */
export class SetupTelegramDto {
  /** Bot API token from BotFather, e.g. `123456:ABC-DEF...`. */
  @IsString()
  @MinLength(1)
  botToken: string;

  /** Bot username without the leading `@`, e.g. `mongez_bot`. */
  @IsString()
  @MinLength(1)
  botUsername: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
