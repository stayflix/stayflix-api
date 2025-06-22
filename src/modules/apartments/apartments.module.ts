import { Module } from '@nestjs/common';
import { MyApartmentsController } from './my-apartments.controller';
import { ApartmentService } from './apartments.service';
import { ApartmentsController } from './apartments.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  ApartmentReviews,
  Apartments,
  Bookings,
  Wishlist,
  WishlistedApartments,
} from './apartments.entity';
import { BlacklistedTokens, Users } from '../users/users.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature({
      entities: [
        Apartments,
        Wishlist,
        WishlistedApartments,
        BlacklistedTokens,
        Users,
        ApartmentReviews,
        Bookings,
      ],
    }),
  ],
  controllers: [MyApartmentsController, ApartmentsController],
  providers: [ApartmentService],
  exports: [ApartmentService],
})
export class ApartmentsModule {}
