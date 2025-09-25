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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly apartmentService: ApartmentService,
    private readonly userService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Admin root', description: 'Basic admin API status endpoint.' })
  @ApiOkResponse({ description: 'Welcome message', schema: { type: 'string', example: 'Welcome to Stayflix Admin!!!' } })
  getHello(): string {
    return 'Welcome to Stayflix Admin!!!';
  }

  @Post('auth/login')
  @AllowUnauthorizedRequest()
  @UseGuards(AdminLocalAuthGuard)
  @ApiOperation({ summary: 'Admin login', description: 'Authenticates an admin and returns access/refresh tokens.' })
  @ApiCreatedResponse({ description: 'Authenticated', schema: { type: 'object' } })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() _body: dtos.AdminLoginDTO, @Req() req: any) {
    return this.service.login(req.user);
  }

  @Post('user')
  @ApiOperation({ summary: 'Create admin user', description: 'Creates a new admin user.' })
  @ApiCreatedResponse({ description: 'Admin user created', schema: { type: 'object' } })
  createUser(@Body() body: dtos.AdminUserDto) {
    return this.service.createUser(body);
  }

  @Get('earnings')
  @ApiOperation({ summary: 'Get earnings', description: 'Gets dashboard earnings for the specified year.' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiOkResponse({ description: 'Earnings data', schema: { type: 'object' } })
  @ApiBadRequestResponse({ description: 'Invalid year' })
  async getEarnings(@Query('year') year: string) {
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear)) throw new BadRequestException('Invalid year');
    return this.apartmentService.getDashboardEarnings(parsedYear);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List bookings', description: 'Returns bookings with optional filters and pagination.' })
  @ApiOkResponse({ description: 'Bookings list', schema: { type: 'object' } })
  async getBookings(@Query() query: dtos.BookingFilterDto) {
    return this.apartmentService.getBookings(query);
  }

  @Get('users')
  @ApiOperation({ summary: 'List users', description: 'Returns paginated users with optional filters.' })
  @ApiOkResponse({ description: 'Users list', schema: { type: 'object' } })
  async getUsers(@Query() query: dtos.UserListQueryDto) {
    return this.userService.getPaginatedUsers(query);
  }

  @Get('users/:uuid')
  @ApiOperation({ summary: 'Get user details', description: 'Returns a user and their bookings by UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'User details', schema: { type: 'object' } })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUserDetails(@Param('uuid') uuid: string) {
    return this.userService.getUserWithBookings(uuid);
  }

  @Get('apartments')
  @ApiOperation({ summary: 'List apartments', description: 'Returns admin apartments list with filters.' })
  @ApiOkResponse({ description: 'Apartments list', schema: { type: 'object' } })
  async getApartments(@Query() query: any) {
    return this.apartmentService.getApartments(query);
  }

  @Get('apartments/:uuid')
  @ApiOperation({ summary: 'Get apartment', description: 'Returns an apartment by UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'Apartment details', schema: { type: 'object' } })
  @ApiNotFoundResponse({ description: 'Apartment not found' })
  async getApartment(@Param('uuid') uuid: string) {
    return this.apartmentService.getApartment(uuid);
  }

  @Get('apartments/:uuid/map-link')
  @ApiOperation({ summary: 'Get map link', description: 'Returns a map link for the given apartment UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'Map link', schema: { type: 'string' } })
  async getMapLink(@Param('uuid') uuid: string) {
    return this.apartmentService.getMapLink(uuid);
  }

  @Put('apartments/:uuid')
  @ApiOperation({ summary: 'Update apartment', description: 'Updates an apartment by UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'Updated apartment', schema: { type: 'object' } })
  async updateApartment(
    @Param('uuid') uuid: string,
    @Body() dto: dtos.UpdateApartmentDto,
  ) {
    return this.apartmentService.adminUpdateApartment(uuid, dto);
  }

  @Patch(':uuid/status')
  @ApiOperation({ summary: 'Update apartment status', description: 'Updates apartment status by UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'Status updated' })
  updateApartmentStatus(
    @Param('uuid') uuid: string,
    @Body() dto: dtos.UpdateApartmentStatusDto,
  ) {
    return this.apartmentService.updateApartmentStatus(uuid, dto.status);
  }

  @Patch('status/bulk')
  @ApiOperation({ summary: 'Bulk update status', description: 'Updates status for multiple apartments.' })
  @ApiOkResponse({ description: 'Bulk status updated' })
  updateBulkStatus(@Body() body: dtos.UpdateApartmentBulkStatusDto) {
    return this.apartmentService.updateBulkStatus(body.uuids, body.status);
  }

  @Get(':uuid/reviews')
  @ApiOperation({ summary: 'Get reviews', description: 'Gets reviews for an apartment by UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'Reviews list', schema: { type: 'object' } })
  getReviews(@Param('uuid') uuid: string) {
    return this.apartmentService.getReviews(uuid);
  }

  @Get('payments/pay-ins')
  @ApiOperation({ summary: 'List pay-ins', description: 'Gets pay-in transactions with filters.' })
  @ApiOkResponse({ description: 'Pay-ins list', schema: { type: 'object' } })
  getPayIns(@Query() query: dtos.PaymentQueryDto) {
    return this.apartmentService.getPayIns(query);
  }

  @Get('payments/pay-outs')
  @ApiOperation({ summary: 'List pay-outs', description: 'Gets pay-out transactions with filters.' })
  @ApiOkResponse({ description: 'Pay-outs list', schema: { type: 'object' } })
  getPayOuts(@Query() query: dtos.PaymentQueryDto) {
    return this.apartmentService.getPayOuts(query);
  }

  @Get('support-tickets')
  @ApiOperation({ summary: 'List support tickets', description: 'Gets support tickets with filters.' })
  @ApiOkResponse({ description: 'Support tickets list', schema: { type: 'object' } })
  getTickets(@Query() query: dtos.SupportTicketQueryDto) {
    return this.apartmentService.getTickets(query);
  }

  @Patch('support-tickets/:uuid/resolve')
  @ApiOperation({ summary: 'Resolve support ticket', description: 'Marks a support ticket as resolved by UUID.' })
  @ApiParam({ name: 'uuid', type: String })
  @ApiOkResponse({ description: 'Ticket resolved' })
  resolveTicket(@Param('uuid') uuid: string) {
    return this.apartmentService.resolveTicket(uuid);
  }
}
