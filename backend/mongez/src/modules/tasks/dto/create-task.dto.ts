import { IsString, IsEnum, IsOptional, Length, IsDateString, IsInt, Min, IsArray } from 'class-validator';
import { TaskStatus, Priority } from '@prisma/client';

export class CreateTaskDto {
  @IsString() @Length(1, 500) title: string;
  @IsString() boardId: string;
  @IsString() columnId: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus = TaskStatus.TODO;
  @IsOptional() @IsEnum(Priority) priority?: Priority = Priority.MEDIUM;
  @IsOptional() @IsString() type?: string;           // 'Bug' | 'Feature' | 'Task' | 'Milestone'
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsInt() @Min(0) estimatedHours?: number;
  @IsOptional() @IsString() parentId?: string;       // for subtasks
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) assigneeIds?: string[];
}
