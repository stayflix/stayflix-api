import { Module } from '@nestjs/common';
import { ListController } from './lists.controller';
import { ConfigModule } from '@nestjs/config';
import { PaystackConfiguration } from 'src/config/configuration';
import { ListService } from './lists.service';

@Module({
  imports: [ConfigModule.forFeature(PaystackConfiguration)],
  providers: [ListService],
  controllers: [ListController],
  exports: [ListService],
})
export class ListModule {}
