import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { NotificationStatus } from '@prisma/client';

export class NotificationFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsEnum(NotificationStatus, { message: 'status must be a valid NotificationStatus (PENDING, SENT, READ, FAILED)' })
  status?: NotificationStatus;
}
