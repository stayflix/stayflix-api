import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Conversation, Message } from './chat.entity';
import { Users } from '../users/users.entity';
import { Apartments } from '../apartments/apartments.entity';
import { AdminUser } from '../admin/admin.entities';
import { AdminChatController } from './admin-chat.controller';
import { ChatGateway } from './chat.gateway';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthConfiguration } from 'src/config/configuration';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MikroOrmModule.forFeature({
      entities: [Conversation, Message, Users, Apartments, AdminUser],
    }),
    ConfigModule.forFeature(JwtAuthConfiguration),
    JwtModule.register({}),
  ],
  controllers: [ChatController, AdminChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
