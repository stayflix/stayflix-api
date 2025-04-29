import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PaginationInput } from 'src/base/dto';
import {
  DiscountType,
  FirstReservationType,
  ReservationType,
  SpaceTypeAvailable,
} from 'src/types';

export class CreateApartmentDto {
  @IsString()
  @IsOptional()
  uuid: string;

  @IsString()
  apartmentType: string;

  @IsEnum(SpaceTypeAvailable)
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
  reservationType: ReservationType;

  @IsEnum(FirstReservationType)
  firstReservationType: FirstReservationType;

  @IsNumber()
  weekdayBasePrice: number;

  @IsEnum(DiscountType, { each: true })
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
  reservationType: ReservationType;

  @IsEnum(FirstReservationType)
  @IsOptional()
  firstReservationType: FirstReservationType;

  @IsNumber()
  @IsOptional()
  weekdayBasePrice: number;

  @IsEnum(DiscountType, { each: true })
  @IsOptional()
  allowedDiscounts: DiscountType[];
}

export class ApartmentFilter {
  @IsString()
  @IsOptional()
  status: string;

  @IsString()
  @IsOptional()
  apartmentType: string;
}

export class MyApartmentQuery {
  @ValidateNested()
  @Type(() => ApartmentFilter)
  @IsOptional()
  filter: ApartmentFilter;

  @IsString()
  @IsOptional()
  search: string;

  @ValidateNested()
  @Type(() => PaginationInput)
  @IsOptional()
  pagination: PaginationInput;
}

export class CreateWishlistDto {
  @IsString()
  name: string;
}

export class AddToWishlistDto {
  @IsString()
  uuid: string;
}
