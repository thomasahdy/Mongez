import { IsString, IsNotEmpty, IsIn, IsOptional, MaxLength } from 'class-validator';

export class FeedbackDto {
  @IsString()
  @IsNotEmpty()
  traceId: string;

  @IsNotEmpty()
  @IsIn([1, -1, 'positive', 'negative'])
  rating: 1 | -1 | 'positive' | 'negative';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
