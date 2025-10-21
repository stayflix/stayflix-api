import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { InitiatePayoutDto } from './payments.dto';
import { AdminJwtAuthGuard } from '../admin/guards/jwt-auth-guard';
import { Request } from 'express';

@Controller('admin/payouts')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth()
@ApiTags('admin-payouts')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate payout', description: 'Initiates a payout to a user via Paystack transfer.' })
  initiatePayout(@Body() dto: InitiatePayoutDto, @Req() req: Request) {
    return this.paymentsService.initiatePayout(dto, req.user as any);
  }
}
