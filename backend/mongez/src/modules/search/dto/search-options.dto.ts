import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchOptionsDto {
  @IsString()
  q!: string;

  @IsString()
  spaceId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[] = ['task', 'approval', 'file', 'comment'];

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;
}