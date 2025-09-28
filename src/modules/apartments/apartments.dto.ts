import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PaginationInput, PaginationQuery } from 'src/base/dto';
import {
  DiscountType,
  FirstReservationType,
  ReservationType,
  SpaceTypeAvailable,
  ApartmentStatus,
} from 'src/types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApartmentDto {
  @IsString()
  @IsOptional()
  uuid: string;

  @IsString()
  apartmentType: string;

  @IsEnum(SpaceTypeAvailable)
  @ApiProperty({ enum: SpaceTypeAvailable, enumName: 'SpaceTypeAvailable', example: SpaceTypeAvailable.ENTIRE_PLACE })
  spaceTypeAvailable: SpaceTypeAvailable;

  @IsString()
  address: string;

  @IsNumber()
  guestCount: number;

  @IsNumber()
  bedroomCount: number;

  @IsNumber()
  bedCount: number;

  @IsNumber()
  bathroomCount: number;

  @IsString()
  amenities: string;

  @IsString()
  photos: string;

  @IsString()
  title: string;

  @IsString()
  highlights: string;

  @IsString()
  description: string;

  @IsEnum(ReservationType)
  @ApiProperty({ enum: ReservationType, enumName: 'ReservationType', example: ReservationType.INSTANT_BOOK })
  reservationType: ReservationType;

  @IsEnum(FirstReservationType)
  @ApiProperty({ enum: FirstReservationType, enumName: 'FirstReservationType', example: FirstReservationType.GUEST })
  firstReservationType: FirstReservationType;

  @IsNumber()
  weekdayBasePrice: number;

  @IsEnum(DiscountType, { each: true })
  @ApiProperty({ enum: DiscountType, enumName: 'DiscountType', isArray: true, example: [DiscountType.NEW_LISTING, DiscountType.WEEKLY] })
  allowedDiscounts: DiscountType[];
}

export class CreateDraftApartmentDto {
  @IsString()
  @IsOptional()
  uuid: string;

  @IsString()
  @IsOptional()
  apartmentType: string;

  @IsEnum(SpaceTypeAvailable)
  @IsOptional()
  @ApiPropertyOptional({ enum: SpaceTypeAvailable, enumName: 'SpaceTypeAvailable', example: SpaceTypeAvailable.ENTIRE_PLACE })
  spaceTypeAvailable: SpaceTypeAvailable;

  @IsString()
  @IsOptional()
  address: string;

  @IsNumber()
  @IsOptional()
  guestCount: number;

  @IsNumber()
  @IsOptional()
  bedroomCount: number;

  @IsNumber()
  @IsOptional()
  bedCount: number;

  @IsNumber()
  @IsOptional()
  bathroomCount: number;

  @IsString()
  @IsOptional()
  amenities: string;

  @IsString()
  @IsOptional()
  photos: string;

  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  highlights: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsEnum(ReservationType)
  @IsOptional()
  @ApiPropertyOptional({ enum: ReservationType, enumName: 'ReservationType', example: ReservationType.INSTANT_BOOK })
  reservationType: ReservationType;

  @IsEnum(FirstReservationType)
  @IsOptional()
  @ApiPropertyOptional({ enum: FirstReservationType, enumName: 'FirstReservationType', example: FirstReservationType.GUEST })
  firstReservationType: FirstReservationType;

  @IsNumber()
  @IsOptional()
  weekdayBasePrice: number;

  @IsEnum(DiscountType, { each: true })
  @IsOptional()
  @ApiPropertyOptional({ enum: DiscountType, enumName: 'DiscountType', isArray: true, example: [DiscountType.NEW_LISTING, DiscountType.WEEKLY] })
  allowedDiscounts: DiscountType[];
}

export class ApartmentFilter {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    name: 'filter[status]',
    enum: ApartmentStatus,
    enumName: 'ApartmentStatus',
    example: ApartmentStatus.AVAILABLE,
  })
  status: string;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ name: 'filter[apartmentType]', type: String })
  apartmentType: string;
}

export class MyApartmentQuery {
  @ValidateNested()
  @Type(() => ApartmentFilter)
  @IsOptional()
  @ApiPropertyOptional({ type: ApartmentFilter })
  filter: ApartmentFilter;

  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ type: String })
  search: string;

  @ValidateNested()
  @Type(() => PaginationInput)
  @IsOptional()
  @ApiPropertyOptional({ type: PaginationInput })
  pagination: PaginationInput;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String })
  userUuid: string;
}

export class CreateWishlistDto {
  @IsString()
  name: string;
}

export class AddToWishlistDto {
  @IsString()
  uuid: string;
}

export class MyBookingsQuery extends PaginationQuery {}

export class BookApartmentDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  transactionId: string;
}
