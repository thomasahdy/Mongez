import { IsString, IsOptional, IsBoolean, IsEnum, IsISO8601, IsArray } from 'class-validator';
import { CalendarEventVisibility } from '@prisma/client';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @IsBoolean()
  @IsOptional()
  allDay?: boolean;

  @IsEnum(CalendarEventVisibility)
  @IsOptional()
  visibility?: CalendarEventVisibility;

  @IsString()
  @IsOptional()
  location?: string;

  @IsOptional()
  reminders?: any;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participants?: string[]; // Array of participant emails
}
