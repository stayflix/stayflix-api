import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApartmentService } from './apartments.service';
import { MyApartmentQuery } from './apartments.dto';

@Controller('apartments')
@ApiTags('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Get()
  @ApiQuery({ name: 'pagination[page]', required: true, type: Number })
  @ApiQuery({ name: 'pagination[limit]', required: true, type: Number })
  fetchApartments(@Query() query: MyApartmentQuery) {
    return this.apartmentService.fetchApartments(
      query.filter,
      query.pagination,
      query.search,
      query.userUuid,
    );
  }

  @Get(':uuid')
  getApartment(
    @Param('uuid') uuid: string,
    @Query('userUuid') userUuid: string,
  ) {
    return this.apartmentService.getApartment(uuid, userUuid);
  }
}
