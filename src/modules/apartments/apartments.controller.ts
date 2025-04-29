import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApartmentService } from './apartments.service';
import { Request } from 'express';
import {
  AddToWishlistDto,
  CreateWishlistDto,
  MyApartmentQuery,
} from './apartments.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';

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
}
