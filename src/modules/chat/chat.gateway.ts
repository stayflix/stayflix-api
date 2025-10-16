import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { ChatService, SenderContext } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { JwtAuthConfiguration } from 'src/config/configuration';
import { IAdminAuthContext, IAuthContext } from 'src/types';
import { SendMessageDto } from './chat.dto';
import { Conversation, Message } from './chat.entity';

type GatewayIdentity =
  | { kind: 'USER'; user: IAuthContext }
  | { kind: 'ADMIN'; admin: IAdminAuthContext };

interface SendMessagePayload {
  conversationUuid: string;
  message: string;
}

interface JoinConversationPayload {
  conversationUuid: string;
}

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly userSockets = new Map<string, Set<string>>();
  private readonly adminSockets = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    @Inject(JwtAuthConfiguration.KEY)
    private readonly jwtConfig: ConfigType<typeof JwtAuthConfiguration>,
  ) {}

  async handleConnection(client: Socket) {
    const identity = await this.resolveIdentity(client);
    if (!identity) {
      client.emit('chat:error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }

    client.data.identity = identity;

    if (identity.kind === 'USER') {
      this.addSocket(this.userSockets, identity.user.uuid, client.id);
      client.join(`user:${identity.user.uuid}`);
    } else {
      this.addSocket(this.adminSockets, identity.admin.uuid, client.id);
      client.join('admin');
      client.join(`admin:${identity.admin.uuid}`);
    }

    client.emit('chat:connected', { status: 'ok' });
  }

  handleDisconnect(client: Socket) {
    const identity = client.data.identity as GatewayIdentity | undefined;
    if (!identity) return;

    if (identity.kind === 'USER') {
      this.removeSocket(this.userSockets, identity.user.uuid, client.id);
    } else {
      this.removeSocket(this.adminSockets, identity.admin.uuid, client.id);
    }
  }

  @SubscribeMessage('joinConversation')
  async joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    const identity = this.getIdentity(client);
    if (!identity) {
      return { status: 'error', message: 'Unauthorized' };
    }
    if (!payload?.conversationUuid) {
      return { status: 'error', message: 'conversationUuid is required' };
    }

    try {
      await this.chatService.getConversationForContext(
        payload.conversationUuid,
        this.identityToSenderContext(identity),
      );
      client.join(payload.conversationUuid);
      return { status: 'ok' };
    } catch (error: any) {
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('leaveConversation')
  leaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinConversationPayload,
  ) {
    if (payload?.conversationUuid) {
      client.leave(payload.conversationUuid);
    }
    return { status: 'ok' };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const identity = this.getIdentity(client);
    if (!identity) {
      return { status: 'error', message: 'Unauthorized' };
    }
    if (!payload?.conversationUuid || !payload?.message) {
      return { status: 'error', message: 'conversationUuid and message are required' };
    }

    const dto: SendMessageDto = { message: payload.message };
    try {
      const { conversation, message, payload: response } =
        await this.chatService.sendMessageInConversation(
          payload.conversationUuid,
          dto,
          this.identityToSenderContext(identity),
        );
      this.broadcastMessage(conversation, message);
      return { status: 'ok', data: response };
    } catch (error: any) {
      return { status: 'error', message: error.message };
    }
  }

  broadcastMessage(conversation: Conversation, message: Message) {
    const conversationPayload = this.chatService.mapConversation(conversation);
    const messagePayload = this.chatService.mapMessage(message);
    const payload = { conversation: conversationPayload, message: messagePayload };

    if (conversation.uuid) {
      this.server.to(conversation.uuid).emit('chat:message', payload);
    }

    if (conversationPayload.user?.uuid) {
      this.server
        .to(`user:${conversationPayload.user.uuid}`)
        .emit('chat:message', payload);
      this.server
        .to(`user:${conversationPayload.user.uuid}`)
        .emit('chat:conversation-updated', conversationPayload);
    }

    if (conversationPayload.host?.uuid) {
      this.server
        .to(`user:${conversationPayload.host.uuid}`)
        .emit('chat:message', payload);
      this.server
        .to(`user:${conversationPayload.host.uuid}`)
        .emit('chat:conversation-updated', conversationPayload);
    }

    this.server.to('admin').emit('chat:message', payload);
    this.server
      .to('admin')
      .emit('chat:conversation-updated', conversationPayload);
  }

  private getIdentity(client: Socket): GatewayIdentity | undefined {
    return client.data.identity as GatewayIdentity | undefined;
  }

  private async resolveIdentity(client: Socket) {
    const token = this.extractToken(client);
    if (!token) return null;

    try {
      const payload = await this.jwtService.verifyAsync<IAuthContext>(token, {
        secret: this.jwtConfig.secretKey,
      });
      return {
        kind: 'USER',
        user: {
          uuid: payload.uuid,
          email: payload.email,
          fullName: (payload as any).fullName,
          phone: (payload as any).phone,
        },
      } as GatewayIdentity;
    } catch {
      // ignore and try admin secret
    }

    try {
      const payload = await this.jwtService.verifyAsync<IAdminAuthContext>(
        token,
        {
          secret: this.jwtConfig.adminSecretKey,
        },
      );
      return {
        kind: 'ADMIN',
        admin: {
          uuid: payload.uuid,
          email: payload.email,
          name: (payload as any).name,
        },
      } as GatewayIdentity;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return authToken;
    }
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }
    return null;
  }

  private addSocket(
    store: Map<string, Set<string>>,
    key: string,
    socketId: string,
  ) {
    if (!store.has(key)) {
      store.set(key, new Set());
    }
    store.get(key)!.add(socketId);
  }

  private removeSocket(
    store: Map<string, Set<string>>,
    key: string,
    socketId: string,
  ) {
    const set = store.get(key);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) {
      store.delete(key);
    }
  }

  private identityToSenderContext(identity: GatewayIdentity): SenderContext {
    if (identity.kind === 'ADMIN') {
      return { kind: 'ADMIN', admin: identity.admin };
    }
    return { kind: 'USER', user: identity.user };
  }
}
