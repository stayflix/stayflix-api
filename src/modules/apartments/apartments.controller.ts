import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApartmentService } from './apartments.service';
import {
  MyApartmentQuery,
} from './apartments.dto';

@Controller('apartments')
@ApiTags('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Get()
  fetchApartments(@Query() query: MyApartmentQuery) {
    return this.apartmentService.fetchApartments(
      query.filter,
      query.pagination,
      query.search,
    );
  }

  @Get(':uuid')
  getApartment(@Param('uuid') uuid: string) {
    return this.apartmentService.getApartment(uuid);
  }
}
