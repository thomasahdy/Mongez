import { IsString, IsNotEmpty, IsOptional, MaxLength, IsArray } from 'class-validator';

export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  boardId?: string;

  /** Optional task context (for task-scoped risk scans) */
  @IsOptional()
  @IsString()
  taskId?: string;

  /** Comment tone preference (professional, friendly, concise, urgent) */
  @IsOptional()
  @IsString()
  commentTone?: string;

  /** Array of selected context item IDs to include in the request */
  @IsOptional()
  @IsArray()
  context?: string[];
}
