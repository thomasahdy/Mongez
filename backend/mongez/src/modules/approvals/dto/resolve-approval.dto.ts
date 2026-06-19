import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ResolveApprovalDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  comment?: string;
}
