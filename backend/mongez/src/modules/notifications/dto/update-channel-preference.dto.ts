import { IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateChannelPreferenceDto {
  @ApiProperty({ description: 'The communication channel name', enum: ['inApp', 'email', 'whatsapp', 'telegram'] })
  @IsIn(['inApp', 'email', 'whatsapp', 'telegram'], { message: 'channel must be one of: inApp, email, whatsapp, telegram' })
  channel: string;

  @ApiProperty({ description: 'Enable or disable the channel' })
  @IsBoolean()
  enabled: boolean;
}
