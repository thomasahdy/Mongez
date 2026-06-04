import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RiskAnalysisDto {
  @IsString()
  @IsNotEmpty()
  spaceId: string;

  @IsOptional()
  @IsString()
  boardId?: string;

  @IsOptional()
  @IsString()
  taskId?: string;
}
