import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsNotEmpty({ message: 'Token is required' })
  @IsString()
  token: string;
}