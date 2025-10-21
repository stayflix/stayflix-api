import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AdminJwtAuthGuard } from '../admin/guards/jwt-auth-guard';
import { CouponsService } from './coupons.service';
import {
  AssignCouponDto,
  CouponListQuery,
  CreateCouponDto,
  UpdateCouponDto,
  UpdateCouponStatusDto,
} from './coupons.dto';

@Controller('admin/coupons')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth()
@ApiTags('admin-coupons')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Create coupon', description: 'Creates a new coupon' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.createCoupon(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List coupons', description: 'Lists coupons with optional filters and pagination' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'INACTIVE', 'EXPIRED', 'EXHAUSTED'],
  })
  @ApiQuery({ name: 'pagination[page]', required: false, type: Number })
  @ApiQuery({ name: 'pagination[limit]', required: false, type: Number })
  list(@Query() query: CouponListQuery) {
    return this.couponsService.listCoupons(query);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get coupon', description: 'Gets coupon details by UUID' })
  @ApiParam({ name: 'uuid', type: String })
  findOne(@Param('uuid') uuid: string) {
    return this.couponsService.getCoupon(uuid);
  }

  @Patch(':uuid')
  @ApiOperation({ summary: 'Update coupon', description: 'Updates coupon metadata' })
  @ApiParam({ name: 'uuid', type: String })
  update(@Param('uuid') uuid: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.updateCoupon(uuid, dto);
  }

  @Patch(':uuid/status')
  @ApiOperation({ summary: 'Update coupon status', description: 'Updates coupon status (activate/deactivate)' })
  updateStatus(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateCouponStatusDto,
  ) {
    return this.couponsService.updateCouponStatus(uuid, dto);
  }

  @Patch(':uuid/assign')
  @ApiOperation({ summary: 'Assign coupon', description: 'Assigns a coupon to a user' })
  assign(@Param('uuid') uuid: string, @Body() dto: AssignCouponDto) {
    return this.couponsService.assignCoupon(uuid, dto);
  }

  @Patch(':uuid/unassign')
  @ApiOperation({ summary: 'Unassign coupon', description: 'Removes coupon user assignment' })
  unassign(@Param('uuid') uuid: string) {
    return this.couponsService.unassignCoupon(uuid);
  }

  @Delete(':uuid')
  @ApiOperation({ summary: 'Delete coupon', description: 'Soft deletes a coupon' })
  remove(@Param('uuid') uuid: string) {
    return this.couponsService.deleteCoupon(uuid);
  }
}
