import {
  Entity,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Timestamp } from '../../base/timestamp.entity';
import { Users } from '../users/users.entity';

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'user_bank_accounts' })
export class UserBankAccount extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: false,
  })
  user!: Users;

  @Property()
  bankName: string;

  @Property()
  bankCode: string;

  @Property()
  accountName: string;

  @Property()
  @Unique()
  accountNumber: string;

  @Property({ nullable: true })
  recipientCode?: string;

  @Property({ default: false })
  isDefault: boolean = false;
}
