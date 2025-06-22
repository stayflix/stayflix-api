import {
  EntityManager,
  EntityRepository,
  FindOptions,
  QueryOrder,
} from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApartmentFilter,
  BookApartmentDto,
  CreateApartmentDto,
  CreateDraftApartmentDto,
  CreateWishlistDto,
} from './apartments.dto';
import { ApartmentStatus, IAuthContext } from 'src/types';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  ApartmentReviews,
  Apartments,
  Bookings,
  BookingStatus,
  PayIn,
  PayOut,
  SupportTicket,
  Wishlist,
  WishlistedApartments,
} from './apartments.entity';
import { Users } from '../users/users.entity';
import { v4 } from 'uuid';
import { PaginationInput } from 'src/base/dto';
import { buildResponseDataWithPagination } from 'src/utils';
import {
  BookingFilterDto,
  PaymentQueryDto,
  SupportTicketQueryDto,
  UpdateApartmentDto,
} from '../admin/admin.dto';

@Injectable()
export class ApartmentService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Apartments)
    private readonly apartmentsRepository: EntityRepository<Apartments>,
    @InjectRepository(Users)
    private readonly usersRepository: EntityRepository<Users>,
    @InjectRepository(Wishlist)
    private readonly wishlistRepository: EntityRepository<Wishlist>,
    @InjectRepository(WishlistedApartments)
    private readonly wishlistedApartmentsRepository: EntityRepository<WishlistedApartments>,
    @InjectRepository(Bookings)
    private readonly bookingsRepository: EntityRepository<Bookings>,
  ) {}

  async getBookings({ status, sort, page = 1, limit = 10 }: BookingFilterDto) {
    const where: any = { isCancelled: false };
    if (status && status !== 'all') {
      where.status =
        status === 'checked_in'
          ? BookingStatus.CHECKED_IN
          : BookingStatus.BOOKED;
    }
    const orderBy = (() => {
      switch (sort) {
        case 'date_asc':
          return { startDate: QueryOrder.ASC };
        case 'date_desc':
          return { startDate: QueryOrder.DESC };
        case 'amount_asc':
          return { totalAmount: QueryOrder.ASC };
        case 'amount_desc':
          return { totalAmount: QueryOrder.DESC };
        case 'status':
          return { status: QueryOrder.ASC };
        default:
          return { startDate: QueryOrder.DESC };
      }
    })();
    const [data, total] = await this.bookingsRepository.findAndCount(where, {
      populate: ['apartment', 'user'],
      orderBy,
      offset: (page - 1) * limit,
      limit,
    });
    const bookings = data.map((b) => ({
      apartmentTitle: b.apartment?.title,
      location: b.apartment?.address,
      bookedDate: b.startDate,
      duration: this.getDurationInMonths(b.startDate, b.endDate),
      totalAmount: b.totalAmount,
      status: b.status,
    }));
    return {
      data: bookings,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  private getDurationInMonths(start: Date, end: Date): string {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return `${months || 1} Month${months > 1 ? 's' : ''}`;
  }

  async getDashboardEarnings(year: number) {
    const bookings = await this.bookingsRepository.find({
      isCancelled: false,
      startDate: {
        $gte: new Date(`${year}-01-01T00:00:00Z`),
        $lte: new Date(`${year}-12-31T23:59:59Z`),
      },
    });
    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => ({
      month: this.getMonthName(i),
      paidOut: 0,
      expected: 0,
    }));
    let paidOut = 0;
    let expected = 0;
    for (const booking of bookings) {
      const monthIndex = new Date(booking.startDate).getMonth();
      if (booking.isPaidOut) {
        monthlyBreakdown[monthIndex].paidOut += booking.totalAmount;
        paidOut += booking.totalAmount;
      } else {
        monthlyBreakdown[monthIndex].expected += booking.totalAmount;
        expected += booking.totalAmount;
      }
    }
    return {
      year,
      total: paidOut + expected,
      paidOut,
      expected,
      monthlyBreakdown,
    };
  }

  private getMonthName(index: number) {
    return [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ][index];
  }

  async bookApartment(
    apartmentUuid: string,
    { startDate, endDate }: BookApartmentDto,
    { uuid }: IAuthContext,
  ) {
    const apartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
    });
    if (!apartment || !apartment.published) {
      throw new BadRequestException('Apartment not available');
    }
    const conflictingBooking = await this.bookingsRepository.findOne({
      apartment: { uuid: apartment.uuid },
      isCancelled: false,
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        },
      ],
    });
    if (conflictingBooking) {
      throw new ConflictException(
        'Apartment already booked for selected dates',
      );
    }
    const booking = this.bookingsRepository.create({
      uuid: v4(),
      apartment: this.apartmentsRepository.getReference(apartmentUuid),
      user: this.usersRepository.getReference(uuid),
      startDate,
      endDate,
      reservationType: apartment.reservationType,
      totalAmount: this.calculateTotalAmount(
        apartment,
        new Date(startDate),
        new Date(endDate),
      ),
    });
    this.em.persist(booking);
    await this.em.flush();
    return {
      status: true,
      message: 'Apartment booked successfully',
      data: booking,
    };
  }

  private calculateTotalAmount(
    apartment: Apartments,
    start: Date,
    end: Date,
  ): number {
    const diffInDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffInDays * (apartment.weekdayBasePrice || 0);
  }

  async deleteWishlist(wishlistUuid: string) {
    const wishlistExists = await this.wishlistRepository.findOne({
      uuid: wishlistUuid,
    });
    if (!wishlistExists) throw new NotFoundException('Wishlist not found');
    await this.wishlistRepository.nativeDelete({ uuid: wishlistUuid });
    await this.wishlistedApartmentsRepository.nativeDelete({
      wishlist: { uuid: wishlistUuid },
    });
    return { message: 'Wishlist deleted successfully' };
  }

  async removeFromWishlist(apartmentUuid: string, wishlistUuid: string) {
    const [apartmentExists, wishlistExists, apartmentExistInWishlist] =
      await Promise.all([
        this.apartmentsRepository.findOne({
          uuid: apartmentUuid,
        }),
        this.wishlistRepository.findOne({ uuid: wishlistUuid }),
        this.wishlistedApartmentsRepository.findOne({
          apartment: { uuid: apartmentUuid },
          wishlist: { uuid: wishlistUuid },
        }),
      ]);
    if (!apartmentExists) throw new NotFoundException('Apartment not found');
    if (!wishlistExists) throw new NotFoundException('Wishlist not found');
    if (!apartmentExistInWishlist)
      throw new ConflictException('Apartment does not exist in wishlist');
    await this.wishlistedApartmentsRepository.nativeDelete({
      uuid: apartmentExistInWishlist.uuid,
    });
    return { message: 'Apartment removed from wishlist' };
  }

  async addToWishlist(apartmentUuid: string, wishlistUuid: string) {
    const [apartmentExists, wishlistExists, apartmentExistInWishlist] =
      await Promise.all([
        this.apartmentsRepository.findOne({
          uuid: apartmentUuid,
        }),
        this.wishlistRepository.findOne({ uuid: wishlistUuid }),
        this.wishlistedApartmentsRepository.findOne({
          apartment: { uuid: apartmentUuid },
          wishlist: { uuid: wishlistUuid },
        }),
      ]);
    if (!apartmentExists) throw new NotFoundException('Apartment not found');
    if (!wishlistExists) throw new NotFoundException('Wishlist not found');
    if (apartmentExistInWishlist)
      throw new ConflictException('Apartment already exists in wishlist');
    const wishlistedApartmentModel = this.wishlistedApartmentsRepository.create(
      {
        uuid: v4(),
        wishlist: this.wishlistRepository.getReference(wishlistUuid),
        apartment: this.apartmentsRepository.getReference(apartmentUuid),
      },
    );
    this.em.persist(wishlistedApartmentModel);
    await this.em.flush();
    return { message: 'Apartment added to wishlist' };
  }

  async createWishlist(
    apartmentUuid: string,
    dto: CreateWishlistDto,
    { uuid }: IAuthContext,
  ) {
    const [wishlistExists, apartmentExists] = await Promise.all([
      this.wishlistRepository.findOne({
        user: { uuid },
        title: dto.name,
      }),
      this.apartmentsRepository.findOne({
        uuid: apartmentUuid,
      }),
    ]);
    if (wishlistExists)
      throw new ConflictException(
        `Wishlist with name: ${dto.name} already exists`,
      );
    if (!apartmentExists) throw new NotFoundException(`Apartment not found`);
    const wishlistUuid = v4();
    const wishlistModel = this.wishlistRepository.create({
      uuid: wishlistUuid,
      title: dto.name,
      user: this.usersRepository.getReference(uuid),
    });
    const wishlistedApartmentModel = this.wishlistedApartmentsRepository.create(
      {
        uuid: v4(),
        wishlist: this.wishlistRepository.getReference(wishlistUuid),
        apartment: this.apartmentsRepository.getReference(apartmentUuid),
      },
    );
    this.em.persist(wishlistModel);
    this.em.persist(wishlistedApartmentModel);
    await this.em.flush();
    return { message: 'Wishlist created successfully' };
  }

  async getApartment(apartmentUuid: string) {
    return this.apartmentsRepository.findOne({ uuid: apartmentUuid });
  }

  async fetchApartments(
    filter: ApartmentFilter,
    pagination: PaginationInput,
    search: string,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const conditions = {
      ...(search ? { title: { $ilike: `%${search}%` } } : {}),
      ...(filter?.apartmentType
        ? { apartmentType: filter?.apartmentType }
        : {}),
    };
    const [totalApartments, apartments] = await Promise.all([
      this.apartmentsRepository.count(conditions),
      this.apartmentsRepository.find(conditions, {
        limit,
        offset: limit * (page - 1),
        orderBy: {
          [pagination?.orderBy || 'createdAt']: pagination?.orderDir || 'DESC',
        },
      }),
    ]);
    return buildResponseDataWithPagination(apartments, totalApartments, {
      page,
      limit,
    });
  }

  async fetchMyApartments(
    filter: ApartmentFilter,
    pagination: PaginationInput,
    search: string,
    { uuid }: IAuthContext,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const conditions = {
      createdBy: { uuid },
      ...(search ? { title: { $ilike: `%${search}%` } } : {}),
      ...(filter?.status === 'draft'
        ? { draft: true }
        : filter?.status === 'published'
          ? { published: true }
          : { published: false, draft: false }),
    };
    const [totalApartments, apartments] = await Promise.all([
      this.apartmentsRepository.count(conditions),
      this.apartmentsRepository.find(conditions, {
        limit,
        offset: limit * (page - 1),
        orderBy: {
          [pagination?.orderBy || 'createdAt']: pagination?.orderDir || 'DESC',
        },
      }),
    ]);
    return buildResponseDataWithPagination(apartments, totalApartments, {
      page,
      limit,
    });
  }

  async getMyApartment(apartmentUuid: string, { uuid }: IAuthContext) {
    return this.apartmentsRepository.find({
      uuid: apartmentUuid,
      createdBy: { uuid },
    });
  }

  async updateApartment(
    apartmentUuid: string,
    dto: CreateDraftApartmentDto,
    { uuid }: IAuthContext,
  ) {
    const existingApartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
      draft: true,
      createdBy: { uuid },
    });
    if (!existingApartment)
      throw new NotFoundException('Apartment does not exist');
    this.updateApartmentEntity(existingApartment, dto, true);
    await this.em.flush();
    return { message: 'Apartment updated successfully' };
  }

  async deleteApartment(apartmentUuid: string, { uuid }: IAuthContext) {
    const existingApartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
      draft: true,
      createdBy: { uuid },
    });
    if (!existingApartment)
      throw new NotFoundException('Apartment does not exist');
    await this.apartmentsRepository.nativeDelete({ uuid: apartmentUuid });
    return { message: 'Apartment deleted successfully' };
  }

  private updateApartmentEntity(
    entity: any,
    dto: CreateApartmentDto | CreateDraftApartmentDto,
    isDraft: boolean,
  ) {
    entity.apartmentType = dto.apartmentType;
    entity.spaceTypeAvailable = dto.spaceTypeAvailable;
    entity.address = dto.address;
    entity.guestCount = dto.guestCount;
    entity.bedroomCount = dto.bedroomCount;
    entity.bedCount = dto.bedCount;
    entity.bathroomCount = dto.bathroomCount;
    entity.amenities = dto.amenities;
    entity.photos = dto.photos;
    entity.title = dto.title;
    entity.highlights = dto.highlights;
    entity.description = dto.description;
    entity.reservationType = dto.reservationType;
    entity.firstReservationType = dto.firstReservationType;
    entity.weekdayBasePrice = dto.weekdayBasePrice;
    entity.allowedDiscounts = dto.allowedDiscounts?.join(',') ?? '';
    entity.draft = isDraft;
  }

  private buildApartmentPayload(
    dto: CreateApartmentDto | CreateDraftApartmentDto,
    uuid: string,
    isDraft: boolean,
  ) {
    return {
      uuid: v4(),
      apartmentType: dto.apartmentType,
      spaceTypeAvailable: dto.spaceTypeAvailable,
      address: dto.address,
      guestCount: dto.guestCount,
      bedroomCount: dto.bedroomCount,
      bedCount: dto.bedCount,
      bathroomCount: dto.bathroomCount,
      amenities: dto.amenities,
      photos: dto.photos,
      title: dto.title,
      highlights: dto.highlights,
      description: dto.description,
      reservationType: dto.reservationType,
      firstReservationType: dto.firstReservationType,
      weekdayBasePrice: dto.weekdayBasePrice,
      allowedDiscounts: dto.allowedDiscounts?.join(',') ?? '',
      draft: isDraft,
      createdBy: this.usersRepository.getReference(uuid),
    };
  }

  async createApartment(dto: CreateApartmentDto, { uuid }: IAuthContext) {
    return this.handleCreateOrUpdate(dto, uuid, false);
  }

  async createDraftApartment(
    dto: CreateDraftApartmentDto,
    { uuid }: IAuthContext,
  ) {
    return this.handleCreateOrUpdate(dto, uuid, true);
  }

  private async handleCreateOrUpdate(
    dto: CreateApartmentDto | CreateDraftApartmentDto,
    userUuid: string,
    isDraft: boolean,
  ) {
    if (dto.uuid) {
      const existingApartment = await this.apartmentsRepository.findOne({
        uuid: dto.uuid,
      });
      if (!existingApartment)
        throw new NotFoundException('Apartment not found');
      this.updateApartmentEntity(existingApartment, dto, isDraft);
      await this.em.flush();
      return { message: 'Apartment created successfully' };
    } else {
      const newApartment = this.apartmentsRepository.create(
        this.buildApartmentPayload(dto, userUuid, isDraft),
      );
      this.em.persist(newApartment);
      await this.em.flush();
      return {
        message: 'Apartment created successfully',
        data: { apartmentUuid: newApartment.uuid },
      };
    }
  }

  async getApartments(query: any) {
    const filters: any = {};

    if (query.status) {
      filters.status = query.status;
    }

    if (query.search) {
      filters.title = { $like: `%${query.search}%` };
    }

    let orderBy: any = {};
    if (query.sort === 'price_asc') {
      orderBy = { weekdayBasePrice: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { weekdayBasePrice: 'desc' };
    } else if (query.sort === 'recent') {
      orderBy = { createdAt: 'desc' };
    }

    return this.em.find(Apartments, filters, { orderBy });
  }

  async getMapLink(uuid: string) {
    const apt = await this.getApartment(uuid);
    return {
      mapUrl: `https://maps.google.com/?q=${encodeURIComponent(apt.address || '')}`,
    };
  }

  async adminUpdateApartment(uuid: string, dto: UpdateApartmentDto) {
    const apt = await this.getApartment(uuid);
    this.em.assign(apt, dto);
    await this.em.flush();
    return apt;
  }

  async updateApartmentStatus(uuid: string, status: ApartmentStatus) {
    const apt = await this.getApartment(uuid);
    apt.status = status;
    await this.em.flush();
    return apt;
  }

  async updateBulkStatus(uuids: string[], status: ApartmentStatus) {
    await this.em.nativeUpdate(
      Apartments,
      { uuid: { $in: uuids } },
      { status },
    );
    return { message: 'Status updated for selected apartments' };
  }

  async getReviews(uuid: string) {
    const apartment = await this.getApartment(uuid);

    const reviews = await this.em.find(
      ApartmentReviews,
      {
        apartment: uuid,
      },
      {
        populate: ['user'],
        orderBy: { createdAt: 'desc' },
      },
    );

    return {
      avgRating: apartment.avgRating,
      reviews: reviews.map((r) => ({
        user: r.user?.fullName || 'Anonymous',
        rating: r.rating,
        comment: r.review,
        createdAt: r.createdAt,
      })),
    };
  }

  async getPayIns(query: PaymentQueryDto) {
    const filters: any = {};
    if (query.search) {
      filters.$or = [
        { user: { fullName: { $like: `%${query.search}%` } } },
        { apartment: { title: { $like: `%${query.search}%` } } },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      filters.createdAt = {};
      if (query.dateFrom) filters.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filters.createdAt.$lte = new Date(query.dateTo);
    }

    return this.em.find(PayIn, filters, {
      populate: ['user', 'apartment'],
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayOuts(query: PaymentQueryDto) {
    const filters: any = {};
    if (query.search) {
      filters.$or = [
        { user: { fullName: { $like: `%${query.search}%` } } },
        { apartment: { title: { $like: `%${query.search}%` } } },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      filters.createdAt = {};
      if (query.dateFrom) filters.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filters.createdAt.$lte = new Date(query.dateTo);
    }

    return this.em.find(PayOut, filters, {
      populate: ['user', 'apartment'],
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTickets(query: SupportTicketQueryDto) {
    const filters: any = {};
    if (query.status) filters.status = query.status;
    if (query.search) {
      filters.$or = [
        { fullName: { $like: `%${query.search}%` } },
        { email: { $like: `%${query.search}%` } },
      ];
    }
    return this.em.find(SupportTicket, filters, {
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveTicket(uuid: string) {
    const ticket = await this.em.findOne(SupportTicket, { uuid });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = 'resolved';
    await this.em.flush();
    return ticket;
  }
}
