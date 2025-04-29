import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { OrderDir } from 'src/types';

export class PaginationInput {
  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  orderBy?: string = '';

  @IsOptional()
  @IsEnum(OrderDir)
  orderDir?: OrderDir;
}

export class BasePaginatedResponseDto {
  pagination?: {
    total: number;
    limit: number;
    page: number;
    size: number;
    pages: number;
    offset?: number;
  };

  data: any;
}

export class PaginationQuery {
  @ValidateNested()
  @Type(() => PaginationInput)
  pagination?: PaginationInput;
}
