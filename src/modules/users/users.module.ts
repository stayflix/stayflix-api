import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { BlacklistedTokens, Users } from './users.entity';
import { SharedModule } from '../shared/shared.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from 'src/strategies/jwt.strategy';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthConfiguration, PaystackConfiguration } from 'src/config/configuration';

@Module({
  imports: [
    ConfigModule.forFeature(PaystackConfiguration),
    ConfigModule.forFeature(JwtAuthConfiguration),
    MikroOrmModule.forFeature({
      entities: [Users, BlacklistedTokens],
    }),
    SharedModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy],
  exports: [UsersService],
})
export class UsersModule {}
