import {
  Entity,
  Enum,
  Filter,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Timestamp } from '../../base/timestamp.entity';
import { CouponStatus } from '../../types';
import { Users } from '../users/users.entity';

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'coupons' })
export class Coupon extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @Property()
  @Unique()
  code: string;

  @Property({ nullable: true })
  description?: string;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Property({ type: 'decimal', precision: 10, scale: 2 })
  remainingAmount: number;

  @Enum({ items: () => CouponStatus, default: CouponStatus.ACTIVE })
  status: CouponStatus = CouponStatus.ACTIVE;

  @Property({ type: 'datetime', nullable: true })
  expiresAt?: Date;

  @ManyToOne(() => Users, {
    fieldName: 'assigned_to',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  assignedTo?: Users;
}
