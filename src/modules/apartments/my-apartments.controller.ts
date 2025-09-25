import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { ApartmentService } from './apartments.service';
import {
  AddToWishlistDto,
  BookApartmentDto,
  CreateApartmentDto,
  CreateDraftApartmentDto,
  CreateWishlistDto,
  MyApartmentQuery,
} from './apartments.dto';
import { Request } from 'express';

@Controller('my-apartments')
@ApiTags('my-apartments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MyApartmentsController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Post()
  @ApiOperation({ summary: 'Create apartment', description: 'Creates a new apartment for the authenticated user.' })
  @ApiCreatedResponse({ description: 'Apartment created', schema: { type: 'object' } })
  createApartment(@Body() body: CreateApartmentDto, @Req() req: Request) {
    return this.apartmentService.createApartment(body, req.user as any);
  }

  @Post('draft')
  @ApiOperation({ summary: 'Save draft apartment', description: 'Creates or updates an apartment draft for the authenticated user.' })
  @ApiCreatedResponse({ description: 'Draft saved', schema: { type: 'object' } })
  createDraftApartment(
    @Body() body: CreateDraftApartmentDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.createDraftApartment(body, req.user as any);
  }

  @Get()
  @ApiOperation({ summary: 'List my apartments', description: 'Returns the authenticated user apartments with pagination and optional search/filter.' })
  @ApiOkResponse({ description: 'Paginated list of apartments', schema: { type: 'object' } })
  fetchMyApartments(@Query() query: MyApartmentQuery, @Req() req: Request) {
    return this.apartmentService.fetchMyApartments(
      query.filter,
      query.pagination,
      query.search,
      req.user as any,
    );
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get my apartment', description: 'Gets an apartment by UUID created by the authenticated user.' })
  @ApiOkResponse({ description: 'Apartment details', schema: { type: 'object' } })
  getMyApartment(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.apartmentService.getMyApartment(uuid, req.user as any);
  }

  @Put(':uuid')
  @ApiOperation({ summary: 'Update apartment', description: 'Updates an apartment owned by the authenticated user.' })
  @ApiOkResponse({ description: 'Apartment updated', schema: { type: 'object' } })
  updateApartment(
    @Param('uuid') uuid: string,
    @Body() body: CreateDraftApartmentDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.updateApartment(uuid, body, req.user as any);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete apartment', description: 'Deletes an apartment owned by the authenticated user.' })
  @ApiOkResponse({ description: 'Apartment deleted' })
  deleteApartment(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.apartmentService.deleteApartment(uuid, req.user as any);
  }

  @Get('wishlist')
  @ApiOperation({ summary: 'List wishlist', description: 'Returns the wishlist items of the authenticated user.' })
  @ApiOkResponse({ description: 'Wishlist items', schema: { type: 'object' } })
  fetchWishlistItems(@Req() req: Request) {
    return this.apartmentService.fetchWishlistItems(req.user as any);
  }

  @Post(':uuid/add-to-wishlist')
  @ApiOperation({ summary: 'Add to wishlist', description: 'Adds an apartment to the authenticated user wishlist.' })
  @ApiOkResponse({ description: 'Added to wishlist' })
  addToWishlist(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.apartmentService.addToWishlist(uuid, req.user as any);
  }

  @Post(':uuid/remove-from-wishlist')
  @ApiOperation({ summary: 'Remove from wishlist', description: 'Removes an apartment from the authenticated user wishlist.' })
  @ApiOkResponse({ description: 'Removed from wishlist' })
  removeFromWishlist(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.apartmentService.removeFromWishlist(uuid, req.user as any);
  }

  @Post(':uuid/book')
  @ApiOperation({ summary: 'Book apartment', description: 'Books an apartment for the authenticated user.' })
  @ApiCreatedResponse({ description: 'Booking created', schema: { type: 'object' } })
  bookApartment(
    @Param('uuid') uuid: string,
    @Body() body: BookApartmentDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.bookApartment(uuid, body, req.user as any);
  }
}
