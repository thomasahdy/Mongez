import { IsString, IsEnum } from 'class-validator';
import { DependencyType } from '@prisma/client';

export class AddDependencyDto {
  @IsString() targetTaskId: string;
  @IsEnum(DependencyType) type: DependencyType;  // BLOCKS, RELATES_TO, etc.
}
