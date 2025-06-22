export enum OrderDir {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum OTPActionType {
  VERIFY_ACCOUNT = 'VERIFY_ACCOUNT',
  RESET_PASSWORD = 'RESET_PASSWORD',
  ADMIN_RESET_PASSWORD = 'ADMIN_RESET_PASSWORD',
}

export enum SpaceTypeAvailable {
  ENTIRE_PLACE = 'ENTIRE_PLACE',
  ROOM = 'ROOM',
  SHARED_ROOM = 'SHARED_ROOM',
}

export enum ReservationType {
  INSTANT_BOOK = 'INSTANT_BOOK',
  BOOKING_REQUEST = 'BOOKING_REQUEST',
}

export enum FirstReservationType {
  GUEST = 'GUEST',
  EXPERIENCED_GUEST = 'EXPERIENCED_GUEST',
}

export enum DiscountType {
  NEW_LISTING = 'NEW_LISTING',
  LAST_MINUTE = 'LAST_MINUTE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum ApartmentStatus {
  PENDING = 'PENDING',
  AVAILABLE = 'AVAILABLE',
}

export enum RegistrationType {
  GOOGLE = 'GOOGLE',
  FACEBOOK = 'FACEBOOK',
  APPLE = 'APPLE',
  WEB = 'WEB',
  MOBILE = 'MOBILE',
}

export interface IEmailDto {
  templateCode: string;
  to?: string;
  subject: string;
  from?: string;
  bcc?: string;
  html?: string;
  data?: any;
}

export interface IAuthContext {
  email: string;
  uuid: string;
  fullName: string;
  phone: string;
}

export interface IAdminAuthContext {
  name: string;
  email: string;
  uuid: string;
}
