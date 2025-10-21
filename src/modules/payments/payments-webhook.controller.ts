import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { Request } from 'express';

@Controller('payments/paystack')
@ApiTags('payments-webhook')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook', description: 'Handles Paystack payout webhook notifications.' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    if (!signature) {
      throw new ForbiddenException('Missing Paystack signature');
    }
    const rawBody =
      req.rawBody?.toString() ?? JSON.stringify(body, Object.keys(body).sort());
    await this.paymentsService.handlePaystackWebhook(body, rawBody, signature);
    return { received: true };
  }
}
