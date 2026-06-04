import { IsString, IsEnum, IsOptional, Length, IsArray, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BoardType } from '@prisma/client';

export class CreateBoardDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsEnum(BoardType)
  type: BoardType = BoardType.KANBAN;

  @IsString()
  departmentId: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsEnum(BoardType)
  type?: BoardType;

  @IsOptional()
  @IsString()
  description?: string;
}

import { IsString as IsStr, IsInt as IsInt2, Min as Min2, IsOptional as IsOpt, Matches } from 'class-validator';

export class CreateColumnDto {
  @IsStr()
  @Length(1, 50)
  name: string;

  @IsOpt()
  @IsStr()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code' })
  color?: string;

  @IsOpt()
  @IsInt2()
  @Min2(0)
  wipLimit?: number;  // 0 = no limit

  @IsOpt()
  @IsInt2()
  @Min2(0)
  position?: number;
}

export class UpdateColumnDto {
  @IsOpt()
  @IsStr()
  @Length(1, 50)
  name?: string;

  @IsOpt()
  @IsStr()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code' })
  color?: string;

  @IsOpt()
  @IsInt2()
  @Min2(0)
  wipLimit?: number;
}

export class ColumnOrderItem {
  @IsStr()
  id: string;

  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderColumnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnOrderItem)
  columns: ColumnOrderItem[];
}
