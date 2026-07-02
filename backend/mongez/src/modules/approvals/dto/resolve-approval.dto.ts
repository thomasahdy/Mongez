import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class ResolveApprovalDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  @IsNotEmpty()
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  comment?: string;

  // Frontend historically sends `reason`; accept it as an alias for `comment`
  // so approve/reject does not fail global `forbidNonWhitelisted` validation.
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}
