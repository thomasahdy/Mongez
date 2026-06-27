import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateMemoryProfileDto {
  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  preferredReportStyle?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @IsOptional()
  favoriteBoardIds?: string[];

  @IsOptional()
  preferences?: any;
}
