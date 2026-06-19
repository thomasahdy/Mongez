import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum WorkflowEntityType {
  TASK = 'TASK',
  AI_ACTION = 'AI_ACTION',
  BUDGET = 'BUDGET',
  CUSTOM = 'CUSTOM',
}

export class StartWorkflowDto {
  @ApiProperty()
  @IsString()
  definitionId!: string;

  @ApiProperty()
  @IsString()
  spaceId!: string;

  @ApiProperty({ enum: WorkflowEntityType })
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value)
  @IsEnum(WorkflowEntityType)
  entityType!: WorkflowEntityType;

  @ApiProperty()
  @IsString()
  entityId!: string;

  @ApiPropertyOptional({})
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
