import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateApprovalDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsString()
  @IsNotEmpty()
  reviewerId: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}
