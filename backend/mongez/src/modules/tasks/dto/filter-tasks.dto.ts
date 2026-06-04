import { IsOptional, IsEnum, IsString, IsArray, IsBoolean, IsDateString } from 'class-validator';
import { TaskStatus, Priority } from '@prisma/client';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class FilterTasksDto extends PaginationDto {
  @IsOptional() @IsEnum(TaskStatus, { each: true }) status?: TaskStatus[];
  @IsOptional() @IsEnum(Priority, { each: true }) priority?: Priority[];
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsDateString() dueBefore?: string;
  @IsOptional() @IsDateString() dueAfter?: string;
  @IsOptional() @IsString() search?: string;         // full-text search query
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsBoolean() includeArchived?: boolean = false;
}
