import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class NotificationFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
