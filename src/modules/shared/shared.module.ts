import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  SmtpConfiguration,
  TermiiConfiguration,
} from 'src/config/configuration';
import { NotificationTemplates } from 'src/entities/notification-templates.entity';
import { SharedService } from './shared.service';

@Module({
  imports: [
    ConfigModule.forFeature(SmtpConfiguration),
    ConfigModule.forFeature(TermiiConfiguration),
    MikroOrmModule.forFeature({
      entities: [NotificationTemplates],
    }),
  ],
  providers: [SharedService],
  exports: [SharedService],
})
export class SharedModule {}
