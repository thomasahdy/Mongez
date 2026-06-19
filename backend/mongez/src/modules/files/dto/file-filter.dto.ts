import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../shared/dto/pagination.dto';

export class FileFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  mimeType?: string;
}