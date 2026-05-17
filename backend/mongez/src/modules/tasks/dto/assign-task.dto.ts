import { IsString, IsArray } from 'class-validator';

export class AssignTaskDto {
  @IsArray() @IsString({ each: true }) assigneeIds: string[];
}
