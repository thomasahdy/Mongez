import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ReportDto {
  @IsString()
  @IsNotEmpty()
  spaceId: string;

  @IsOptional()
  @IsString()
  boardId?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'sprint', 'custom'])
  reportType?: 'weekly' | 'monthly' | 'sprint' | 'custom';
}
