import { IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString() @Length(1, 10000) content: string;  // markdown
}

export class UpdateCommentDto {
  @IsString() @Length(1, 10000) content: string;
}
