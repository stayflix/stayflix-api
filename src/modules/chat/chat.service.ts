import { EntityManager, EntityRepository, QueryOrder } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { Conversation, ConversationType, Message, MessageSenderRole } from './chat.entity';
import { Users } from '../users/users.entity';
import { Apartments } from '../apartments/apartments.entity';
import { SendMessageDto } from './chat.dto';
import { IAdminAuthContext, IAuthContext } from 'src/types';
import { AdminUser } from '../admin/admin.entities';

type UserSenderContext = { kind: 'USER'; user: IAuthContext };
type AdminSenderContext = { kind: 'ADMIN'; admin: IAdminAuthContext };
export type SenderContext = UserSenderContext | AdminSenderContext;

const CONVERSATION_POPULATE = ['user', 'host', 'apartment'] as const;
const MESSAGE_POPULATE = ['senderUser', 'senderAdmin', 'conversation'] as const;
const MESSAGE_LIST_POPULATE = ['senderUser', 'senderAdmin'] as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Conversation)
    private readonly conversationsRepository: EntityRepository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: EntityRepository<Message>,
    @InjectRepository(Users)
    private readonly usersRepository: EntityRepository<Users>,
    @InjectRepository(Apartments)
    private readonly apartmentsRepository: EntityRepository<Apartments>,
    @InjectRepository(AdminUser)
    private readonly adminRepository: EntityRepository<AdminUser>,
  ) {}

  async sendMessageToHost(
    apartmentUuid: string,
    dto: SendMessageDto,
    auth: IAuthContext,
  ) {
    const apartment = await this.apartmentsRepository.findOne(
      { uuid: apartmentUuid },
      { populate: ['createdBy'] },
    );

    if (!apartment) throw new NotFoundException('Apartment not found');
    if (!apartment.createdBy)
      throw new BadRequestException('Apartment host not available');

    if (apartment.createdBy.uuid === auth.uuid) {
      throw new ForbiddenException(
        'Hosts must use the conversation endpoint to send messages',
      );
    }

    let conversation = await this.conversationsRepository.findOne(
      {
        type: ConversationType.USER_HOST,
        user: auth.uuid,
        apartment: apartmentUuid,
      },
      { populate: CONVERSATION_POPULATE as any },
    );

    if (!conversation) {
      conversation = this.conversationsRepository.create({
        uuid: v4(),
        type: ConversationType.USER_HOST,
        user: this.usersRepository.getReference(auth.uuid),
        host: this.usersRepository.getReference(apartment.createdBy.uuid),
        apartment,
        lastMessageAt: new Date(),
      });
      this.em.persist(conversation);
      await this.em.flush();
      await this.conversationsRepository.populate(
        conversation,
        CONVERSATION_POPULATE as any,
      );
    }

    return this.createMessage(conversation, dto, { kind: 'USER', user: auth });
  }

  async sendMessageToAdmin(dto: SendMessageDto, auth: IAuthContext) {
    let conversation = await this.conversationsRepository.findOne(
      { type: ConversationType.USER_ADMIN, user: auth.uuid },
      { populate: ['user'] },
    );

    if (!conversation) {
      conversation = this.conversationsRepository.create({
        uuid: v4(),
        type: ConversationType.USER_ADMIN,
        user: this.usersRepository.getReference(auth.uuid),
        lastMessageAt: new Date(),
      });
      this.em.persist(conversation);
      await this.em.flush();
      await this.conversationsRepository.populate(conversation, ['user']);
    }

    return this.createMessage(conversation, dto, { kind: 'USER', user: auth });
  }

  async sendMessageInConversation(
    conversationUuid: string,
    dto: SendMessageDto,
    context: SenderContext,
  ) {
    const conversation = await this.findConversationOrThrow(conversationUuid, {
      populate: CONVERSATION_POPULATE as any,
    });
    await this.ensureParticipant(conversation, context);
    return this.createMessage(conversation, dto, context);
  }

  async getUserConversations(auth: IAuthContext) {
    const conversations = await this.conversationsRepository.find(
      {
        $or: [{ user: auth.uuid }, { host: auth.uuid }],
      },
      {
        populate: CONVERSATION_POPULATE as any,
        orderBy: {
          lastMessageAt: QueryOrder.DESC,
          createdAt: QueryOrder.DESC,
        },
      },
    );

    return conversations.map((conversation) =>
      this.mapConversation(conversation),
    );
  }

  async getConversationMessages(
    conversationUuid: string,
    context: SenderContext,
  ) {
    const conversation = await this.findConversationOrThrow(conversationUuid, {
      populate: CONVERSATION_POPULATE as any,
    });
    await this.ensureParticipant(conversation, context);

    const messages = await this.messagesRepository.find(
      { conversation: conversationUuid },
      {
        populate: MESSAGE_LIST_POPULATE as any,
        orderBy: { createdAt: QueryOrder.ASC },
      },
    );

    return messages.map((message) => this.mapMessage(message));
  }

  async getAdminConversations() {
    const conversations = await this.conversationsRepository.find(
      {},
      {
        populate: CONVERSATION_POPULATE as any,
        orderBy: {
          lastMessageAt: QueryOrder.DESC,
          createdAt: QueryOrder.DESC,
        },
      },
    );
    return conversations.map((conversation) =>
      this.mapConversation(conversation),
    );
  }

  async sendAdminMessage(
    conversationUuid: string,
    dto: SendMessageDto,
    admin: IAdminAuthContext,
  ) {
    return this.sendMessageInConversation(
      conversationUuid,
      dto,
      { kind: 'ADMIN', admin },
    );
  }

  async ensureConversationAccessForAdmin(conversationUuid: string) {
    const conversation = await this.findConversationOrThrow(conversationUuid, {
      populate: CONVERSATION_POPULATE as any,
    });
    return this.mapConversation(conversation);
  }

  async getAdminConversationMessages(conversationUuid: string) {
    const conversation = await this.findConversationOrThrow(conversationUuid, {
      populate: CONVERSATION_POPULATE as any,
    });

    const messages = await this.messagesRepository.find(
      { conversation: conversationUuid },
      {
        populate: MESSAGE_LIST_POPULATE as any,
        orderBy: { createdAt: QueryOrder.ASC },
      },
    );
    return {
      conversation: this.mapConversation(conversation),
      messages: messages.map((message) => this.mapMessage(message)),
    };
  }

  async getConversationForContext(
    conversationUuid: string,
    context: SenderContext,
  ) {
    const conversation = await this.findConversationOrThrow(conversationUuid, {
      populate: CONVERSATION_POPULATE as any,
    });
    await this.ensureParticipant(conversation, context);
    return conversation;
  }

  mapConversation(conversation: Conversation) {
    return {
      uuid: conversation.uuid,
      type: conversation.type,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      user: conversation.user
        ? this.mapUser(conversation.user)
        : null,
      host: conversation.host
        ? this.mapUser(conversation.host)
        : null,
      apartment: conversation.apartment
        ? {
            uuid: conversation.apartment.uuid,
            title: conversation.apartment.title,
            address: conversation.apartment.address,
          }
        : null,
    };
  }

  mapMessage(message: Message) {
    return {
      uuid: message.uuid,
      conversationUuid: message.conversation?.uuid,
      content: message.content,
      senderRole: message.senderRole,
      sender:
        message.senderRole === MessageSenderRole.ADMIN
          ? message.senderAdmin
            ? {
                uuid: message.senderAdmin.uuid,
                name: message.senderAdmin.fullname,
                email: message.senderAdmin.email,
              }
            : null
          : message.senderUser
          ? this.mapUser(message.senderUser)
          : null,
      createdAt: message.createdAt,
    };
  }

  private mapUser(user: Users) {
    return {
      uuid: user.uuid,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
    };
  }

  private async createMessage(
    conversation: Conversation,
    dto: SendMessageDto,
    context: SenderContext,
  ) {
    const now = new Date();
    conversation.lastMessageAt = now;
    const message = this.messagesRepository.create({
      uuid: v4(),
      conversation,
      content: dto.message,
      senderRole: this.resolveSenderRole(conversation, context),
    });

    if (context.kind === 'USER') {
      message.senderUser = this.usersRepository.getReference(
        context.user.uuid,
      );
    } else {
      message.senderAdmin = this.adminRepository.getReference(
        context.admin.uuid,
      );
    }

    this.em.persist(message);
    await this.em.flush();

    await this.messagesRepository.populate(message, MESSAGE_POPULATE as any);

    await this.conversationsRepository.populate(conversation, [
      'user',
      'host',
      'apartment',
    ]);

    return {
      conversation,
      message,
      payload: {
        conversation: this.mapConversation(conversation),
        message: this.mapMessage(message),
      },
    };
  }

  private async ensureParticipant(
    conversation: Conversation,
    context: SenderContext,
  ) {
    if (context.kind === 'ADMIN') {
      return;
    }

    const { user } = context;
    if (
      conversation.user?.uuid === user.uuid ||
      conversation.host?.uuid === user.uuid
    ) {
      return;
    }

    if (
      conversation.type === ConversationType.USER_ADMIN &&
      conversation.user?.uuid === user.uuid
    ) {
      return;
    }

    throw new ForbiddenException('You do not belong to this conversation');
  }

  private resolveSenderRole(
    conversation: Conversation,
    context: SenderContext,
  ): MessageSenderRole {
    if (context.kind === 'ADMIN') {
      return MessageSenderRole.ADMIN;
    }

    if (
      conversation.type === ConversationType.USER_ADMIN &&
      conversation.user?.uuid === context.user.uuid
    ) {
      return MessageSenderRole.USER;
    }

    if (conversation.user?.uuid === context.user.uuid) {
      return MessageSenderRole.USER;
    }

    if (conversation.host?.uuid === context.user.uuid) {
      return MessageSenderRole.HOST;
    }

    throw new ForbiddenException('Invalid sender for this conversation');
  }

  private async findConversationOrThrow(
    uuid: string,
    options?: Parameters<EntityRepository<Conversation>['findOneOrFail']>[1],
  ) {
    const conversation = await this.conversationsRepository.findOne(
      { uuid },
      options,
    );
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }
}
