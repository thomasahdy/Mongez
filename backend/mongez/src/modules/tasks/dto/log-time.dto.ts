import { IsNumber, IsOptional, IsString, Length, IsDateString, Min, Max } from 'class-validator';

export class LogTimeDto {
  @IsNumber() @Min(0.25) @Max(24) hours: number;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsOptional() @IsDateString() date?: string;   // defaults to today
}
