import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code' })
  color?: string;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code' })
  color?: string;
}
