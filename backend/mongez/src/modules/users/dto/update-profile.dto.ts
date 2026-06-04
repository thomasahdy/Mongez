import { IsString, IsOptional, IsUrl, Length, IsIn } from 'class-validator';

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr', 'es', 'de'];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;
}
