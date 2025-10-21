import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { CouponsService } from './coupons.service';
import { VerifyCouponDto } from './coupons.dto';
import { Request } from 'express';

@Controller('coupons')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post('verify')
  @ApiOperation({
    summary: 'Verify coupon',
    description:
      'Validates a coupon code for the authenticated user and returns discount details for the specified booking.',
  })
  verifyCoupon(@Body() dto: VerifyCouponDto, @Req() req: Request) {
    const user = req.user as any;
    return this.couponsService.verifyCouponForUser(user.uuid, dto);
  }
}
