import { IsString, IsOptional } from 'class-validator';

/**
 * Links the authenticated Mongez user to their Telegram account for the active
 * space, creating / updating their `TelegramContact`.
 *
 * At minimum a `chatId` is required (captured automatically when the user first
 * messages the bot). `username` is optional metadata.
 */
export class RegisterTelegramContactDto {
  @IsString()
  chatId: string;

  @IsOptional()
  @IsString()
  username?: string;
}
