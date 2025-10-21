import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { AdminCouponsController } from './admin-coupons.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Coupon } from './coupons.entity';
import { Users } from '../users/users.entity';
import { Apartments } from '../apartments/apartments.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature({
      entities: [Coupon, Users, Apartments],
    }),
  ],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
