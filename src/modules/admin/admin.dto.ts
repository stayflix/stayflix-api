import { Type } from 'class-transformer';
import {
  IsBoolean,
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
import { ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiPropertyOptional({ enum: ['all', 'checked_in', 'booked'], example: 'all' })
  status?: 'all' | 'checked_in' | 'booked';

  @IsOptional()
  @IsIn(['date_desc', 'date_asc', 'amount_desc', 'amount_asc', 'status'])
  @ApiPropertyOptional({ enum: ['date_desc', 'date_asc', 'amount_desc', 'amount_asc', 'status'], example: 'date_desc' })
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
  @ApiPropertyOptional({ enum: ['name', 'email'], example: 'name' })
  sortBy?: 'name' | 'email';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  order?: 'asc' | 'desc';
}

export class UpdateApartmentStatusDto {
  @IsEnum(ApartmentStatus)
  @ApiPropertyOptional({ enum: ApartmentStatus, enumName: 'ApartmentStatus', example: ApartmentStatus.AVAILABLE })
  status: ApartmentStatus;
}

export class UpdateApartmentDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Luxury Suite' })
  title?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '123 Main Street' })
  address?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Lagos' })
  city?: string;
  
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Nigeria' })
  country?: string;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ example: 25000 })
  weekdayBasePrice?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'WiFi,Pool' })
  amenities?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '["photo1.jpg","photo2.jpg"]' })
  photos?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Ocean view, King bed' })
  highlights?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Spacious apartment with city view' })
  description?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  published?: boolean;
}

export class UpdateApartmentBulkStatusDto {
  @IsString({ each: true })
  uuids: string[];

  @IsEnum(ApartmentStatus)
  @ApiPropertyOptional({ enum: ApartmentStatus, enumName: 'ApartmentStatus', example: ApartmentStatus.PENDING })
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
  @ApiPropertyOptional({ enum: TicketStatus, enumName: 'TicketStatus', example: TicketStatus.PENDING })
  status?: TicketStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
