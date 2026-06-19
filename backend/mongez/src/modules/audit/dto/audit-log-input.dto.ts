import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogInput {
  @ApiProperty({ example: 'task.created' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'task.created' })
  @IsString()
  action!: string;

  @ApiProperty({ example: 'task' })
  @IsString()
  entityType!: string;

  @ApiProperty({ example: 'clx123abc' })
  @IsString()
  entityId!: string;

  @ApiPropertyOptional({ example: { field: 'status', from: 'TODO', to: 'DONE' } })
  @IsOptional()
  @IsObject()
  diff?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'clxSpace123' })
  @IsOptional()
  @IsString()
  spaceId?: string;
}