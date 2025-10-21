import { Module } from '@nestjs/common';
import { MyApartmentsController } from './my-apartments.controller';
import { ApartmentService } from './apartments.service';
import { ApartmentsController } from './apartments.controller';
import { FeedbackController } from './feedback.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  ApartmentReviews,
  Apartments,
  Bookings,
  Feedback,
  Payment,
  Wishlist,
} from './apartments.entity';
import { BlacklistedTokens, Users } from '../users/users.entity';
import { ConfigModule } from '@nestjs/config';
import { PaystackConfiguration } from 'src/config/configuration';
import { CouponsModule } from '../coupons/coupons.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MikroOrmModule.forFeature({
      entities: [
        Apartments,
        Wishlist,
        BlacklistedTokens,
        Users,
        ApartmentReviews,
        Bookings,
        Feedback,
        Payment,
      ],
    }),
    ConfigModule.forFeature(PaystackConfiguration),
    CouponsModule,
    PaymentsModule,
  ],
  controllers: [MyApartmentsController, ApartmentsController, FeedbackController],
  providers: [ApartmentService],
  exports: [ApartmentService],
})
export class ApartmentsModule {}
