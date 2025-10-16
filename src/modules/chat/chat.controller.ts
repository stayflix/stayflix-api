import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { SendMessageDto } from './chat.dto';
import { IAuthContext } from 'src/types';

@Controller('chat')
@ApiTags('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('apartments/:uuid/messages')
  @ApiOperation({
    summary: 'Start or continue chat with host',
    description:
      'Creates (if needed) a conversation between the authenticated user and the apartment host, then sends a message.',
  })
  @ApiParam({ name: 'uuid', description: 'Apartment UUID', type: String })
  @ApiCreatedResponse({ description: 'Message sent', schema: { type: 'object' } })
  async sendMessageToHost(
    @Param('uuid') apartmentUuid: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const auth = req.user as IAuthContext;
    const { conversation, message, payload } =
      await this.chatService.sendMessageToHost(apartmentUuid, dto, auth);
    this.chatGateway.broadcastMessage(conversation, message);
    return { status: true, data: payload };
  }

  @Post('admin/messages')
  @ApiOperation({
    summary: 'Send message to admin team',
    description:
      'Creates (if needed) a conversation with the admin team and sends a message.',
  })
  @ApiCreatedResponse({ description: 'Message sent to admins', schema: { type: 'object' } })
  async sendMessageToAdmin(
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const auth = req.user as IAuthContext;
    const { conversation, message, payload } =
      await this.chatService.sendMessageToAdmin(dto, auth);
    this.chatGateway.broadcastMessage(conversation, message);
    return { status: true, data: payload };
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'List conversations',
    description: 'Returns all conversations for the authenticated user (as guest or host).',
  })
  @ApiOkResponse({ description: 'Conversations list', schema: { type: 'array', items: { type: 'object' } } })
  async getConversations(@Req() req: Request) {
    const auth = req.user as IAuthContext;
    const data = await this.chatService.getUserConversations(auth);
    return { status: true, data };
  }

  @Get('conversations/:uuid/messages')
  @ApiOperation({
    summary: 'Get conversation messages',
    description: 'Returns messages for a conversation where the authenticated user is a participant.',
  })
  @ApiParam({ name: 'uuid', description: 'Conversation UUID', type: String })
  @ApiOkResponse({ description: 'Messages list', schema: { type: 'array', items: { type: 'object' } } })
  async getConversationMessages(
    @Param('uuid') conversationUuid: string,
    @Req() req: Request,
  ) {
    const auth = req.user as IAuthContext;
    const data = await this.chatService.getConversationMessages(
      conversationUuid,
      { kind: 'USER', user: auth },
    );
    return { status: true, data };
  }

  @Post('conversations/:uuid/messages')
  @ApiOperation({
    summary: 'Send message in conversation',
    description: 'Sends a message within an existing conversation.',
  })
  @ApiParam({ name: 'uuid', description: 'Conversation UUID', type: String })
  @ApiCreatedResponse({ description: 'Message sent', schema: { type: 'object' } })
  async sendMessageInConversation(
    @Param('uuid') conversationUuid: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    const auth = req.user as IAuthContext;
    const { conversation, message, payload } =
      await this.chatService.sendMessageInConversation(
        conversationUuid,
        dto,
        { kind: 'USER', user: auth },
      );
    this.chatGateway.broadcastMessage(conversation, message);
    return { status: true, data: payload };
  }
}
