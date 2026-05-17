import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, {
    message: 'New password must contain uppercase, lowercase, and a number',
  })
  newPassword: string;
}
