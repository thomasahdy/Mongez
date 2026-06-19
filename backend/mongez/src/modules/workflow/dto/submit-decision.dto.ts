import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkflowDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DELEGATED = 'DELEGATED',
}

export class SubmitDecisionDto {
  @ApiPropertyOptional({ enum: WorkflowDecision })
  @IsOptional()
  @IsEnum(WorkflowDecision)
  decision?: WorkflowDecision;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}