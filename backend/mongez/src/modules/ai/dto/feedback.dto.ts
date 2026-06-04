import { IsString, IsNotEmpty, IsIn, IsOptional, MaxLength } from 'class-validator';

export class FeedbackDto {
  @IsString()
  @IsNotEmpty()
  traceId: string;

  @IsIn([1, -1])
  rating: 1 | -1; // 1 = thumbs up, -1 = thumbs down

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
