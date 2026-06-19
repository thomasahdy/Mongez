import { IsString, IsBoolean, IsOptional, IsArray, IsInt, Min, Max, Length } from 'class-validator';

export class CreateFeatureFlagDto {
  @IsString()
  @Length(1, 100)
  key: string;

  @IsString()
  @Length(1, 500)
  description: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledFor?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;
}

export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledFor?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;
}
