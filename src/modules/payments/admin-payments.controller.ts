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
}
