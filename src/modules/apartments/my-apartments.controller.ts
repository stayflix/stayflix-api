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
import { ApiTags } from '@nestjs/swagger';
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
export class MyApartmentsController {
  constructor(private readonly apartmentService: ApartmentService) {}

  @Post()
  createApartment(@Body() body: CreateApartmentDto, @Req() req: Request) {
    return this.apartmentService.createApartment(body, req.user as any);
  }

  @Post('draft')
  createDraftApartment(
    @Body() body: CreateDraftApartmentDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.createDraftApartment(body, req.user as any);
  }

  @Get()
  fetchMyApartments(@Query() query: MyApartmentQuery, @Req() req: Request) {
    return this.apartmentService.fetchMyApartments(
      query.filter,
      query.pagination,
      query.search,
      req.user as any,
    );
  }

  @Get(':uuid')
  getMyApartment(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.apartmentService.getMyApartment(uuid, req.user as any);
  }

  @Put(':uuid')
  updateApartment(
    @Param('uuid') uuid: string,
    @Body() body: CreateDraftApartmentDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.updateApartment(uuid, body, req.user as any);
  }

  @Delete(':uuid')
  deleteApartment(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.apartmentService.deleteApartment(uuid, req.user as any);
  }

  @Post(':uuid/create-wishlist')
  createWishlist(
    @Param('uuid') uuid: string,
    @Body() body: CreateWishlistDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.createWishlist(uuid, body, req.user as any);
  }

  @Post(':uuid/add-to-wishlist')
  addToWishlist(@Param('uuid') uuid: string, @Body() body: AddToWishlistDto) {
    return this.apartmentService.addToWishlist(uuid, body.uuid);
  }

  @Post(':uuid/remove-from-wishlist')
  removeFromWishlist(
    @Param('uuid') uuid: string,
    @Body() body: AddToWishlistDto,
  ) {
    return this.apartmentService.removeFromWishlist(uuid, body.uuid);
  }

  @Post('wishlist/:uuid/delete')
  deleteWishlist(@Param('uuid') uuid: string) {
    return this.apartmentService.deleteWishlist(uuid);
  }

  @Post(':uuid/book')
  bookApartment(
    @Param('uuid') uuid: string,
    @Body() body: BookApartmentDto,
    @Req() req: Request,
  ) {
    return this.apartmentService.bookApartment(uuid, body, req.user as any);
  }
}
