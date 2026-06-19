import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkflowTriggerType {
  MANUAL = 'MANUAL',
  AI_PROPOSED = 'AI_PROPOSED',
  SCHEDULED = 'SCHEDULED',
}

export enum ApproverType {
  USER = 'USER',
  ROLE = 'ROLE',
  MANAGER_OF_REQUESTER = 'MANAGER_OF_REQUESTER',
}

export class WorkflowStepDto {
  @ApiProperty({ example: 'Manager Approval' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: ApproverType, example: ApproverType.USER })
  @IsEnum(ApproverType)
  approverType!: ApproverType;

  @ApiPropertyOptional({ type: [String], description: 'Specific user IDs when approverType=USER' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approverIds?: string[];

  @ApiPropertyOptional({ description: 'Role name when approverType=ROLE' })
  @IsOptional()
  @IsString()
  approverRole?: string;

  @ApiPropertyOptional({ default: false, description: 'All reviewers act simultaneously' })
  @IsOptional()
  @IsBoolean()
  isParallel?: boolean;

  @ApiPropertyOptional({ default: true, description: 'All must approve, or just one' })
  @IsOptional()
  @IsBoolean()
  requiresAll?: boolean;

  @ApiPropertyOptional({ description: 'Auto-escalate if no decision within N hours' })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeoutHours?: number;
}

export class CreateWorkflowDefinitionDto {
  @ApiProperty()
  @IsString()
  spaceId!: string;

  @ApiProperty({ example: 'Task Approval' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: WorkflowTriggerType })
  @IsEnum(WorkflowTriggerType)
  triggerType!: WorkflowTriggerType;

  @ApiProperty({ type: [WorkflowStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps!: WorkflowStepDto[];
}
