import { IsString, IsNotEmpty } from 'class-validator';

export class AttachDriveFileDto {
  @IsString()
  @IsNotEmpty()
  driveFileId: string;
}
