import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApartmentService } from './apartments.service';
import { ApartmentFilter, MyApartmentQuery } from './apartments.dto';

@Controller('apartments')
@ApiTags('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Get()
  @ApiOperation({ summary: 'List apartments', description: 'Returns paginated apartments, filterable by status and type.' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'userUuid', required: false, type: String })
  @ApiQuery({ name: 'pagination[page]', required: false, type: Number })
  @ApiQuery({ name: 'pagination[limit]', required: false, type: Number })
  @ApiQuery({ name: 'pagination[orderBy]', required: false, type: String })
  @ApiQuery({ name: 'pagination[orderDir]', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'filter[status]', required: false, enum: ['PENDING', 'AVAILABLE'] })
  @ApiQuery({ name: 'filter[apartmentType]', required: false, type: String })
  @ApiOkResponse({ description: 'Paginated apartments list', schema: { type: 'object' } })
  fetchApartments(@Query() query: MyApartmentQuery) {
    return this.apartmentService.fetchApartments(
      query.filter,
      query.pagination,
      query.search,
      query.userUuid,
    );
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get apartment', description: 'Returns an apartment by UUID. Optionally include userUuid for personalized info.' })
  @ApiOkResponse({ description: 'Apartment details', schema: { type: 'object' } })
  getApartment(
    @Param('uuid') uuid: string,
    @Query('userUuid') userUuid: string,
  ) {
    return this.apartmentService.getApartment(uuid, userUuid);
  }
}
