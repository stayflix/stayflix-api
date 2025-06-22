import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminLocalStrategy } from './strategies/local.strategy';
import { AdminJwtStrategy } from './strategies/jwt.strategy';
import { AdminController } from './admin.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AdminUser } from './admin.entities';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtAuthConfiguration } from 'src/config/configuration';
import { JwtModule } from '@nestjs/jwt';
import { ApartmentsModule } from '../apartments/apartments.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MikroOrmModule.forFeature({ entities: [AdminUser] }),
    PassportModule,
    ConfigModule.forFeature(JwtAuthConfiguration),
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(JwtAuthConfiguration)],
      useFactory: (jwtAuthConfig: ConfigType<typeof JwtAuthConfiguration>) => ({
        secret: jwtAuthConfig.adminSecretKey,
        signOptions: { expiresIn: '1h' },
      }),
      inject: [JwtAuthConfiguration.KEY],
    }),
    ApartmentsModule,
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminLocalStrategy, AdminJwtStrategy],
})
export class AdminModule {}
