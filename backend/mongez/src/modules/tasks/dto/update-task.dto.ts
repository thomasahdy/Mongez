import { IsString, IsEnum, IsOptional, Length, IsDateString, IsInt, Min, IsArray } from 'class-validator';
import { TaskStatus, Priority } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional() @IsString() @Length(1, 500) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsInt() @Min(0) estimatedHours?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}
