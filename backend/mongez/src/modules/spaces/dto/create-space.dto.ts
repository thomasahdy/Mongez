import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class CreateSpaceDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code (e.g. #3B82F6)' })
  color?: string;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  @Matches(/^[A-Z]+$/, { message: 'prefix must be uppercase letters only' })
  prefix?: string;
}
