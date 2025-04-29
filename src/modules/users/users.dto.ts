import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(1, 200)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(1, 15)
  phone: string;

  @IsString()
  country: string;

  @IsString()
  state: string;

  @IsString()
  userType: string;

  @IsString()
  @Length(1, 50)
  password: string;
}

export class UpdateUserInfo {
  @IsString()
  @IsOptional()
  fullName: string;

  @IsString()
  @IsOptional()
  preferredFirstname: string;

  @IsString()
  @IsOptional()
  phone: string;

  @IsEmail()
  @IsOptional()
  email: string;

  @IsString()
  @IsOptional()
  country: string;

  @IsString()
  @IsOptional()
  state: string;

  @IsString()
  @IsOptional()
  city: string;

  @IsString()
  @IsOptional()
  emergencyContactFullname: string;

  @IsString()
  @IsOptional()
  emergencyContactRelationship: string;

  @IsString()
  @IsOptional()
  emergencyContactEmail: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone: string;

  @IsString()
  @IsOptional()
  nin: string;
}

export class DeactivateAccountDto {
  @IsString()
  reason: string;
}

export class VerifyBankAccountDto {
  @IsString()
  accountNumber: string;

  @IsString()
  bankCode: string;

  @IsString()
  bankName: string;
}
