import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsISO8601, IsArray } from 'class-validator';
import { CalendarEventVisibility } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;

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
