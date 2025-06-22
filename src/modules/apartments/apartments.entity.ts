import {
  Collection,
  Entity,
  Enum,
  Filter,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/core';
import { Timestamp } from '../../base/timestamp.entity';
import {
  ApartmentStatus,
  FirstReservationType,
  ReservationType,
  SpaceTypeAvailable,
} from '../../types';
import { Users } from '../users/users.entity';

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'apartments' })
export class Apartments extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @Property({ nullable: true })
  apartmentType: string;

  @Enum({ items: () => SpaceTypeAvailable, nullable: true })
  spaceTypeAvailable: SpaceTypeAvailable;

  @Property({ nullable: true })
  address: string;

  @Property({ default: 0 })
  guestCount: number;

  @Property({ default: 0 })
  bedroomCount: number;

  @Property({ default: 0 })
  bedCount: number;

  @Property({ default: 0 })
  bathroomCount: number;

  @Property({ nullable: true })
  amenities: string;

  @Property({ nullable: true })
  photos: string;

  @Property({ nullable: true })
  title: string;

  @Property({ nullable: true })
  city: string;

  @Property({ nullable: true })
  highlights: string;

  @Property({ nullable: true })
  description: string;

  @Enum({ items: () => ReservationType, nullable: true })
  reservationType: ReservationType;

  @Enum({ items: () => FirstReservationType, nullable: true })
  firstReservationType: FirstReservationType;

  @Property({ default: 0 })
  weekdayBasePrice: number;

  @Property({ nullable: true })
  allowedDiscounts: string;

  @ManyToOne(() => Users, {
    fieldName: 'created_by',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  createdBy?: Users;

  @Property({ default: 0 })
  avgRating: number;

  @Property({ default: false })
  published: boolean;

  @Enum({ items: () => ApartmentStatus, nullable: true })
  status: ApartmentStatus;

  @Property({ default: true })
  draft: boolean;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'apartment_reviews' })
export class ApartmentReviews extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  user: Users;

  @ManyToOne(() => Apartments, {
    fieldName: 'apartment',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  apartment: Apartments;

  @Property({ default: 0, nullable: true })
  rating: number;

  @Property({ nullable: true })
  review: string;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'pay_ins' })
export class PayIn extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  user: Users;

  @ManyToOne(() => Apartments, {
    fieldName: 'apartment',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  apartment: Apartments;

  @Property({ nullable: true, default: 0 })
  amount: number;

  @Property({ nullable: true })
  reference: string;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'pay_outs' })
export class PayOut extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  user: Users;

  @ManyToOne(() => Apartments, {
    fieldName: 'apartment',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  apartment: Apartments;

  @Property({ nullable: true, default: 0 })
  amount: number;

  @Property({ nullable: true })
  reference: string;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'support_tickets' })
export class SupportTicket extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @Property({ nullable: true })
  fullName: string;

  @Property({ nullable: true })
  phone: string;

  @Property({ nullable: true })
  email: string;

  @Property({ nullable: true })
  comment: string;

  @Property({ default: 'pending' })
  status: 'pending' | 'resolved';
}

export enum BookingStatus {
  BOOKED = 'Booked',
  CHECKED_IN = 'Checked In',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'bookings' })
export class Bookings extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Apartments, {
    fieldName: 'apartment',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  apartment: Apartments;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  user: Users;

  @Property({ nullable: true })
  startDate: Date;

  @Property({ nullable: true })
  endDate: Date;

  @Property({ default: false })
  isCancelled: boolean;

  @Property({ default: false })
  isPaidOut: boolean;

  @Property({ nullable: true })
  totalAmount: number;

  @Enum({ items: () => ReservationType, nullable: true })
  reservationType: ReservationType;

  @Enum({ items: () => BookingStatus, default: BookingStatus.BOOKED })
  status: BookingStatus;

  @Property({ nullable: true })
  notes: string;
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'wishlist' })
export class Wishlist extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @Property({ nullable: true })
  title: string;

  @ManyToOne(() => Users, {
    fieldName: 'user',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  user?: Users;

  @OneToMany(
    () => WishlistedApartments,
    (wishlistedApartment) => wishlistedApartment.wishlist,
  )
  apartments = new Collection<WishlistedApartments>(this);
}

@Filter({
  name: 'notDeleted',
  cond: { deletedAt: null },
  default: true,
})
@Entity({ tableName: 'wishlisted_apartments' })
@Unique({ properties: ['wishlist', 'apartment'] })
export class WishlistedApartments extends Timestamp {
  @PrimaryKey()
  uuid: string;

  @ManyToOne(() => Wishlist, {
    fieldName: 'wishlist',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
  })
  wishlist?: Wishlist;

  @ManyToOne(() => Apartments, {
    fieldName: 'apartment',
    referenceColumnName: 'uuid',
    columnType: 'varchar(255)',
    nullable: true,
    eager: true,
  })
  apartment?: Apartments;
}
