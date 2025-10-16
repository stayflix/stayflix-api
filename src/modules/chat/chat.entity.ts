import {
  Collection,
  Entity,
  Enum,
  Filter,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { Timestamp } from '../../base/timestamp.entity';
import { Users } from '../users/users.entity';
import { Apartments } from '../apartments/apartments.entity';
import { AdminUser } from '../admin/admin.entities';

export enum ConversationType {
  USER_HOST = 'USER_HOST',
  USER_ADMIN = 'USER_ADMIN',
}

export enum MessageSenderRole {
  USER = 'USER',
  HOST = 'HOST',
  ADMIN = 'ADMIN',
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'conversations' })
export class Conversation extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @Enum({ items: () => ConversationType })
  type: ConversationType;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    nullable: true,
    columnType: 'varchar(255)',
  })
  user?: Users;

  @ManyToOne(() => Users, {
    fieldName: 'host',
    referenceColumnName: 'uuid',
    nullable: true,
    columnType: 'varchar(255)',
  })
  host?: Users;

  @ManyToOne(() => Apartments, {
    fieldName: 'apartment',
    referenceColumnName: 'uuid',
    nullable: true,
    columnType: 'varchar(255)',
  })
  apartment?: Apartments;

  @Property({ nullable: true })
  lastMessageAt?: Date;

  @OneToMany(
    () => Message,
    (message) => message.conversation,
  )
  messages = new Collection<Message>(this);
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'messages' })
export class Message extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Conversation, {
    fieldName: 'conversation',
    referenceColumnName: 'uuid',
    nullable: true,
    columnType: 'varchar(255)',
    deleteRule: 'cascade',
  })
  conversation?: Conversation;

  @Enum({ items: () => MessageSenderRole })
  senderRole: MessageSenderRole;

  @ManyToOne(() => Users, {
    fieldName: 'sender_user',
    referenceColumnName: 'uuid',
    nullable: true,
    columnType: 'varchar(255)',
  })
  senderUser?: Users;

  @ManyToOne(() => AdminUser, {
    fieldName: 'sender_admin',
    referenceColumnName: 'uuid',
    nullable: true,
    columnType: 'varchar(255)',
  })
  senderAdmin?: AdminUser;

  @Property({ columnType: 'text' })
  content: string;
}
