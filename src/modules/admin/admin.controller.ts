import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from './guards/jwt-auth-guard';
import { AdminLocalAuthGuard } from './guards/local-auth-guard';
import { AllowUnauthorizedRequest } from 'src/decorators/unauthorized.decorator';
import * as dtos from './admin.dto';
import { AdminService } from './admin.service';
import { ApartmentService } from '../apartments/apartments.service';
import { UsersService } from '../users/users.service';
import { CreateApartmentDto } from '../apartments/apartments.dto';

@Controller('admin')
@ApiTags('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly apartmentService: ApartmentService,
    private readonly userService: UsersService,
  ) {}

  @Get()
  getHello(): string {
    return 'Welcome to Stayflix Admin!!!';
  }

  @Post('auth/login')
  @AllowUnauthorizedRequest()
  @UseGuards(AdminLocalAuthGuard)
  login(@Body() _body: dtos.AdminLoginDTO, @Req() req: any) {
    return this.service.login(req.user);
  }

  @Post('user')
  createUser(@Body() body: dtos.AdminUserDto) {
    return this.service.createUser(body);
  }

  @Get('earnings')
  async getEarnings(@Query('year') year: string) {
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear)) throw new BadRequestException('Invalid year');
    return this.apartmentService.getDashboardEarnings(parsedYear);
  }

  @Get('bookings')
  async getBookings(@Query() query: dtos.BookingFilterDto) {
    return this.apartmentService.getBookings(query);
  }

  @Get('users')
  async getUsers(@Query() query: dtos.UserListQueryDto) {
    return this.userService.getPaginatedUsers(query);
  }

  @Get('users/:uuid')
  async getUserDetails(@Param('uuid') uuid: string) {
    return this.userService.getUserWithBookings(uuid);
  }

  @Get('apartments')
  async getApartments(@Query() query: any) {
    return this.apartmentService.getApartments(query);
  }

  @Get('apartments/:uuid')
  async getApartment(@Param('uuid') uuid: string) {
    return this.apartmentService.getApartment(uuid);
  }

  @Get('apartments/:uuid/map-link')
  async getMapLink(@Param('uuid') uuid: string) {
    return this.apartmentService.getMapLink(uuid);
  }

  @Put('apartments/:uuid')
  async updateApartment(
    @Param('uuid') uuid: string,
    @Body() dto: dtos.UpdateApartmentDto,
  ) {
    return this.apartmentService.adminUpdateApartment(uuid, dto);
  }

  @Patch(':uuid/status')
  updateApartmentStatus(
    @Param('uuid') uuid: string,
    @Body() dto: dtos.UpdateApartmentStatusDto,
  ) {
    return this.apartmentService.updateApartmentStatus(uuid, dto.status);
  }

  @Patch('status/bulk')
  updateBulkStatus(@Body() body: dtos.UpdateApartmentBulkStatusDto) {
    return this.apartmentService.updateBulkStatus(body.uuids, body.status);
  }

  @Get(':uuid/reviews')
  getReviews(@Param('uuid') uuid: string) {
    return this.apartmentService.getReviews(uuid);
  }

  @Get('payments/pay-ins')
  getPayIns(@Query() query: dtos.PaymentQueryDto) {
    return this.apartmentService.getPayIns(query);
  }

  @Get('payments/pay-outs')
  getPayOuts(@Query() query: dtos.PaymentQueryDto) {
    return this.apartmentService.getPayOuts(query);
  }

  @Get('support-tickets')
  getTickets(@Query() query: dtos.SupportTicketQueryDto) {
    return this.apartmentService.getTickets(query);
  }

  @Patch('support-tickets/:uuid/resolve')
  resolveTicket(@Param('uuid') uuid: string) {
    return this.apartmentService.resolveTicket(uuid);
  }
}
