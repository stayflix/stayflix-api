import { Entity, Enum, Filter, PrimaryKey, Property } from '@mikro-orm/core';
import { Timestamp } from '../../base/timestamp.entity';
import { RegistrationType } from '../../types';

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'users' })
export class Users extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @Property({ nullable: true })
  fullName: string;

  @Property({ nullable: true })
  preferredFirstname: string;

  @Property({ nullable: true })
  email: string;

  @Property({ nullable: true })
  password: string;

  @Property({ nullable: true })
  phone: string;

  @Property({ nullable: true })
  country: string;

  @Property({ nullable: true })
  state: string;

  @Property({ nullable: true })
  city: string;

  @Property({ nullable: true })
  userType: string;

  @Property({ nullable: true })
  picture: string;

  @Property({ nullable: true })
  deviceToken: string;

  @Property({ default: false })
  emailVerified: boolean;

  @Property({ default: false })
  phoneVerified: boolean;

  @Property({ type: 'datetime', nullable: true })
  lastLoggedIn: Date;

  @Property({ nullable: true })
  emergencyContactFullname: string;

  @Property({ nullable: true })
  emergencyContactRelationship: string;

  @Property({ nullable: true })
  emergencyContactEmail: string;

  @Property({ nullable: true })
  emergencyContactPhone: string;

  @Property({ nullable: true })
  nin: string;

  @Property({ nullable: true })
  deactivationReason: string;

  @Enum({ items: () => RegistrationType, nullable: true })
  registrationType!: RegistrationType;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'otp' })
export class OTP extends Timestamp {
  @PrimaryKey()
  uuid!: string;

  @Property({ length: 6 })
  otp!: string;

  @Property()
  pinId!: string;

  @Property({ type: 'datetime', nullable: true })
  expiredAt: Date;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'blacklisted_tokens' })
export class BlacklistedTokens extends Timestamp {
  @PrimaryKey()
  uuid!: string;

  @Property({ type: 'longtext', nullable: true })
  token!: string;
}