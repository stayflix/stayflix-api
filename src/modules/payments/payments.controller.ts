import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ResolveAccountDto, SaveBankAccountDto } from './payments.dto';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { Request } from 'express';

@Controller('payments')
@ApiTags('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('banks')
  @ApiOperation({ summary: 'Fetch Paystack banks', description: 'Retrieves the list of supported Nigerian banks from Paystack.' })
  @ApiOkResponse({ description: 'Paystack bank list' })
  fetchBanks() {
    return this.paymentsService.fetchBanks();
  }

  @Post('resolve-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve bank account', description: 'Resolves an account number and bank code using Paystack as the provider.' })
  resolveAccount(@Body() dto: ResolveAccountDto) {
    return this.paymentsService.resolveAccount(dto);
  }

  @Post('bank-accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save bank account', description: 'Saves a user bank account and registers a Paystack transfer recipient.' })
  saveBankAccount(@Body() dto: SaveBankAccountDto, @Req() req: Request) {
    return this.paymentsService.saveBankAccount(dto, req.user as any);
  }
}
