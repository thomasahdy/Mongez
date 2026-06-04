import { IsEmail, IsString, IsOptional, IsEnum, IsArray, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class OrganizationDto {
  @IsString()
  @MinLength(2, { message: 'Organization name must be at least 2 characters' })
  name: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class InviteDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export const OnboardingTemplate = {
  PROJECT_BOARD: 'project-board',
  NGO_OPERATIONS: 'ngo-operations',
  BUDGET_TRACKER: 'budget-tracker',
  EDUCATION_PROGRAM: 'education-program',
  HEALTHCARE: 'healthcare',
  BLANK: 'blank',
} as const;

export type OnboardingTemplateType = typeof OnboardingTemplate[keyof typeof OnboardingTemplate];

export class CompleteOnboardingDto {
  @ValidateNested()
  @Type(() => OrganizationDto)
  organization: OrganizationDto;

  @IsOptional()
  @IsString()
  template?: OnboardingTemplateType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteDto)
  invites?: InviteDto[];
}