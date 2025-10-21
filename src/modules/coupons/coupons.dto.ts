import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CouponStatus } from 'src/types';
import { PaginationInput } from 'src/base/dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCouponStatusDto {
  @IsEnum(CouponStatus)
  status: CouponStatus;
}

export class AssignCouponDto {
  @IsString()
  @IsNotEmpty()
  userUuid: string;
}

export class CouponListQuery {
  @ValidateNested()
  @Type(() => PaginationInput)
  @IsOptional()
  pagination?: PaginationInput;

  @IsOptional()
  @IsEnum(CouponStatus)
  @ApiPropertyOptional({ enum: CouponStatus, enumName: 'CouponStatus' })
  status?: CouponStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

export class VerifyCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  apartmentUuid: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
