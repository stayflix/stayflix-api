import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserBankAccount } from './payments.entity';
import { Users } from '../users/users.entity';
import { PayOut, Apartments } from '../apartments/apartments.entity';
import { ConfigModule } from '@nestjs/config';
import { PaystackConfiguration } from 'src/config/configuration';

@Module({
  imports: [
    MikroOrmModule.forFeature({
      entities: [UserBankAccount, Users, PayOut, Apartments],
    }),
    ConfigModule.forFeature(PaystackConfiguration),
  ],
  controllers: [
    PaymentsController,
    AdminPaymentsController,
    PaymentsWebhookController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
