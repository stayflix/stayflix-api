import { Body, Controller, Get, Param, Post, UseGuards, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './chat.dto';
import { AdminJwtAuthGuard } from '../admin/guards/jwt-auth-guard';
import { Request } from 'express';
import { IAdminAuthContext } from 'src/types';

@Controller('admin/chat')
@ApiTags('admin-chat')
@UseGuards(AdminJwtAuthGuard)
@ApiBearerAuth()
export class AdminChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'List all conversations',
    description:
      'Returns all user-host and user-admin conversations for administrative oversight.',
  })
  @ApiOkResponse({ description: 'Conversations list', schema: { type: 'array', items: { type: 'object' } } })
  async getConversations() {
    const data = await this.chatService.getAdminConversations();
    return { status: true, data };
  }

  @Get('conversations/:uuid/messages')
  @ApiOperation({
    summary: 'View conversation messages',
    description:
      'Returns every message in the specified conversation for administrative review.',
  })
  @ApiParam({ name: 'uuid', description: 'Conversation UUID', type: String })
  @ApiOkResponse({ description: 'Conversation messages', schema: { type: 'object' } })
  async getConversationMessages(@Param('uuid') conversationUuid: string) {
    const data = await this.chatService.getAdminConversationMessages(
      conversationUuid,
    );
    return { status: true, data };
  }

  @Post('conversations/:uuid/messages')
  @ApiOperation({
    summary: 'Reply in conversation',
    description:
      'Allows any admin to reply within a conversation (user-host or user-admin).',
  })
  @ApiParam({ name: 'uuid', description: 'Conversation UUID', type: String })
  @ApiCreatedResponse({ description: 'Message sent', schema: { type: 'object' } })
  async sendMessage(
    @Param('uuid') conversationUuid: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const admin = req.user as IAdminAuthContext;
    const { conversation, message, payload } =
      await this.chatService.sendAdminMessage(conversationUuid, dto, admin);
    this.chatGateway.broadcastMessage(conversation, message);
    return { status: true, data: payload };
  }
}
