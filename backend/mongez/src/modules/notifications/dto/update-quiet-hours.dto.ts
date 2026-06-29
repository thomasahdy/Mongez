import { IsBoolean, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateQuietHoursDto {
  @ApiProperty({ description: 'Enable or disable quiet hours' })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Start time of quiet hours in HH:mm format', example: '22:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @ApiProperty({ description: 'End time of quiet hours in HH:mm format', example: '07:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @ApiProperty({ description: 'Receive notifications on Egyptian weekend (Friday & Saturday)' })
  @IsBoolean()
  weekendNotifications: boolean;
}
