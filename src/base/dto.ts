import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { OrderDir } from 'src/types';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationInput {
  @IsOptional()
  @IsNumberString()
  @ApiPropertyOptional({ name: 'pagination[limit]', type: Number })
  limit?: number;

  @IsOptional()
  @IsNumberString()
  @ApiPropertyOptional({ name: 'pagination[page]', type: Number })
  page?: number;

  @IsOptional()
  @ApiPropertyOptional({ name: 'pagination[orderBy]', type: String })
  orderBy?: string = '';

  @IsOptional()
  @IsEnum(OrderDir)
  @ApiPropertyOptional({ name: 'pagination[orderDir]', enum: OrderDir, enumName: 'OrderDir', example: OrderDir.DESC })
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
