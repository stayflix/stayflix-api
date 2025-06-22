import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApartmentStatus } from 'src/types';

export class AdminLoginDTO {
  @IsString()
  email: string;

  @IsString()
  password: string;
}

export class AdminUserDto {
  @IsString()
  @Length(1, 150)
  fullname: string;

  @IsEmail()
  @Length(1, 50)
  email: string;

  @IsString()
  @Length(1, 50)
  password: string;
}

export class BookingFilterDto {
  @IsOptional()
  @IsIn(['all', 'checked_in', 'booked'])
  status?: 'all' | 'checked_in' | 'booked';

  @IsOptional()
  @IsIn(['date_desc', 'date_asc', 'amount_desc', 'amount_asc', 'status'])
  sort?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class UserListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['name', 'email'])
  sortBy?: 'name' | 'email';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class UpdateApartmentStatusDto {
  @IsEnum(ApartmentStatus)
  status: ApartmentStatus;
}

export class UpdateApartmentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsNumber()
  weekdayBasePrice?: number;

  @IsOptional()
  @IsString()
  amenities?: string;

  @IsOptional()
  @IsString()
  photos?: string;

  @IsOptional()
  @IsString()
  highlights?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateApartmentBulkStatusDto {
  @IsString({ each: true })
  uuids: string[];

  @IsEnum(ApartmentStatus)
  status: ApartmentStatus;
}

export class PaymentQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export enum TicketStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
}

export class SupportTicketQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
