import { IsString, Matches, Length } from 'class-validator';

/**
 * DTO for requesting an OTP verification code.
 */
export class RequestOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format (e.g. +966500000000)' })
  phoneNumber: string;
}

/**
 * DTO for confirming an OTP verification code.
 */
export class ConfirmOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format (e.g. +966500000000)' })
  phoneNumber: string;

  @IsString()
  @Length(6, 6)
  code: string;
}
