import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { OTPActionType } from 'src/types';

export class SignupStepOneDto {
  @IsEmail()
  @Length(1, 200)
  email: string;

  @IsString()
  @Length(1, 50)
  password: string;
}

export class SignupStepTwoDto {
  @IsString()
  @Length(1, 200)
  fullName: string;

  @IsString()
  phone: string;

  @IsString()
  country: string;

  @IsString()
  state: string;

  @IsString()
  userType: string;

  @IsString()
  uuid: string;

  @IsString()
  @IsOptional()
  picture: string;
}

export class LoginDTO {
  @IsString()
  emailOrPhone: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class VerifyOtpDto {
  @IsString()
  pinId: string;

  @IsString()
  otp: string;

  @IsString()
  userUuid: string;

  @IsEnum(OTPActionType)
  otpActionType: OTPActionType;
}

export class SendOtpDto {
  @IsString()
  userUuid: string;

  @IsEnum(OTPActionType)
  otpActionType: OTPActionType;
}

export class ResetPasswordDto {
  @IsString()
  phone: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 50)
  newPassword: string;

  @IsString()
  @Length(1, 50)
  oldPassword: string;
}

export class NewResetPasswordDto {
  @IsString()
  @Length(1, 50)
  password: string;
}

export class LoginWithGoogleDto {
  @IsString()
  idToken: string;
}

export class LoginWithFacebookDto {
  @IsString()
  accessToken: string;
}

export class LoginWithAppleDto {
  @IsString()
  identityToken: string;
}

export class LogoutDto {
  @IsString()
  refreshToken: string;

  @IsString()
  accessToken: string;
}
