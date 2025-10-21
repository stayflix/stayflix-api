import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApartmentService } from './apartments.service';
import { ApartmentFilter, CreateReviewDto, MyApartmentQuery } from './apartments.dto';
import { OptionalJwtAuthGuard } from 'src/guards/optional-jwt-auth-guard';
import { Request } from 'express';
import { PaginationInput } from 'src/base/dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';

@Controller('apartments')
@ApiTags('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
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
  fetchApartments(@Query() query: MyApartmentQuery, @Req() req: Request) {
    const user = req.user as any;
    const viewerUuid = query.userUuid ?? user?.uuid;
    return this.apartmentService.fetchApartments(
      query.filter,
      query.pagination,
      query.search,
      viewerUuid,
    );
  }

  @Get(':uuid/reviews')
  @ApiOperation({ summary: 'Get apartment reviews', description: 'Fetches reviews and ratings for an apartment.' })
  @ApiOkResponse({ description: 'Paginated apartment reviews', schema: { type: 'object' } })
  getApartmentReviews(
    @Param('uuid') uuid: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pagination: PaginationInput = {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    };
    return this.apartmentService.getPublicApartmentReviews(uuid, pagination);
  }

  @Post(':uuid/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit apartment review', description: 'Allows a user who booked an apartment to submit a review and rating.' })
  submitApartmentReview(
    @Param('uuid') uuid: string,
    @Body() dto: CreateReviewDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.submitReview(uuid, dto, req.user as any);
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
