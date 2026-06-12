import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { FinalizeTransferDto, InitiatePayoutDto } from './payments.dto';
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

  @Get('pending')
  @ApiOperation({ summary: 'List pending payments for all users', description: 'Returns all users who have unpaid completed bookings, with their apartments and totals.' })
  @ApiOkResponse({ description: 'Pending payments grouped by user and apartment' })
  getAllPendingPayments() {
    return this.paymentsService.getPendingPaymentsForAllUsers();
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

  @Post('batches/:uuid/finalize')
  @ApiOperation({ summary: 'Finalize batch payout with OTP', description: 'Finalizes a batch payout that is in `otp` status by submitting the OTP sent by Paystack to the merchant.' })
  finalizeBatchPayout(@Param('uuid') uuid: string, @Body() dto: FinalizeTransferDto) {
    return this.paymentsService.finalizeBatchPayout(uuid, dto);
  }

  @Post('batches/:uuid/resend-otp')
  @ApiOperation({ summary: 'Resend OTP for batch payout', description: 'Asks Paystack to resend the OTP for a batch payout that is in `otp` status.' })
  resendBatchPayoutOtp(@Param('uuid') uuid: string) {
    return this.paymentsService.resendBatchPayoutOtp(uuid);
  }

  @Post('batches/:uuid/reconcile')
  @ApiOperation({ summary: 'Reconcile a successful batch payout', description: 'Manually marks all unpaid bookings tied to apartments in a successful batch as paid. Use this when a Paystack success webhook fired but bookings were not flipped to isPaidOut for any reason.' })
  reconcileBatchPayout(@Param('uuid') uuid: string) {
    return this.paymentsService.reconcileBatchPayout(uuid);
  }

  @Post(':uuid/finalize')
  @ApiOperation({ summary: 'Finalize single payout with OTP', description: 'Finalizes a single payout that is in `otp` status by submitting the OTP sent by Paystack to the merchant.' })
  finalizeSinglePayout(@Param('uuid') uuid: string, @Body() dto: FinalizeTransferDto) {
    return this.paymentsService.finalizeSinglePayout(uuid, dto);
  }

  @Post(':uuid/resend-otp')
  @ApiOperation({ summary: 'Resend OTP for single payout', description: 'Asks Paystack to resend the OTP for a single payout that is in `otp` status.' })
  resendSinglePayoutOtp(@Param('uuid') uuid: string) {
    return this.paymentsService.resendSinglePayoutOtp(uuid);
  }
}
