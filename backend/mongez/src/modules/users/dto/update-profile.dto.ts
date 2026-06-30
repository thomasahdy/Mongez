import { IsString, IsOptional, IsUrl, Length, IsIn, ValidateIf } from 'class-validator';

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'es', 'de'];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;
}
