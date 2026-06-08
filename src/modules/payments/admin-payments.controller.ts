import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
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

  @Get('users/:uuid/bank-accounts')
  @ApiOperation({ summary: 'List user bank accounts', description: 'Returns all bank accounts saved by a specific user.' })
  @ApiOkResponse({ description: 'User bank accounts' })
  fetchUserBankAccounts(@Param('uuid') uuid: string) {
    return this.paymentsService.fetchBankAccountsByUser(uuid);
  }

  @Get('users/:uuid/pending')
  @ApiOperation({ summary: 'List pending payments for user', description: 'Returns all apartments with unpaid completed bookings for a user, grouped by apartment.' })
  @ApiOkResponse({ description: 'Pending payments grouped by apartment' })
  getPendingPayments(@Param('uuid') uuid: string) {
    return this.paymentsService.getPendingPaymentsForUser(uuid);
  }

  @Post('users/:uuid/pay-all')
  @ApiOperation({ summary: 'Pay all pending payments for user', description: 'Initiates a single Paystack transfer for the total of all pending apartment earnings, then marks bookings as settled on transfer success.' })
  payAllPending(@Param('uuid') uuid: string, @Req() req: Request) {
    return this.paymentsService.initiatePayoutAll(uuid, req.user as any);
  }
}
