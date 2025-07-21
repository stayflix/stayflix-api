import {
  EntityManager,
  EntityRepository,
  FindOptions,
  QueryOrder,
} from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApartmentFilter,
  BookApartmentDto,
  CreateApartmentDto,
  CreateDraftApartmentDto,
  CreateWishlistDto,
} from './apartments.dto';
import {
  ApartmentStatus,
  Currencies,
  IAuthContext,
  PaymentType,
} from 'src/types';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  ApartmentReviews,
  Apartments,
  Bookings,
  BookingStatus,
  PayIn,
  Payment,
  PayOut,
  SupportTicket,
  Wishlist,
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
import { PaystackConfiguration } from 'src/config/configuration';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';

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
    @InjectRepository(Bookings)
    private readonly bookingsRepository: EntityRepository<Bookings>,
    @InjectRepository(Payment)
    private readonly paymentRepository: EntityRepository<Payment>,
    @Inject(PaystackConfiguration.KEY)
    private readonly paystackConfig: ConfigType<typeof PaystackConfiguration>,
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
    { startDate, endDate, transactionId }: BookApartmentDto,
    { uuid }: IAuthContext,
  ) {
    const transResponse = await axios
      .get(
        `${this.paystackConfig.baseUrl}/transaction/verify/${encodeURIComponent(transactionId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackConfig.secretKey}`,
          },
        },
      )
      .catch((error) => {
        console.log(error.response);
        throw new InternalServerErrorException(
          `An error occurred while trying to verify the transaction with paystack. Error: ${error}`,
        );
      });
    const paymentData = transResponse.data.data;
    if (paymentData.status.toLowerCase() !== 'success') {
      throw new ForbiddenException(`Transaction was not successful`);
    }
    const apartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
    });
    if (!apartment || !apartment.published) {
      throw new BadRequestException('Apartment not available');
    }
    if (apartment.weekdayBasePrice !== +paymentData.amount / 100) {
      throw new ForbiddenException(`Amount paid must match apartment price`);
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
    const paymentUuid = v4();
    const paymentModel = this.paymentRepository.create({
      uuid: paymentUuid,
      transactionId: transactionId.toString(),
      metadata: JSON.stringify(paymentData),
      type: PaymentType.INCOMING,
      amount: apartment.weekdayBasePrice,
      channel: paymentData.paymentMethod,
      status: 'success',
      currency: Currencies.NGN,
    });
    const booking = this.bookingsRepository.create({
      uuid: v4(),
      apartment: this.apartmentsRepository.getReference(apartmentUuid),
      payment: this.paymentRepository.getReference(paymentUuid),
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
    this.em.persist(paymentModel);
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

  async fetchWishlistItems({ uuid }: IAuthContext) {
    return this.wishlistRepository.find(
      {
        user: { uuid },
      },
      { populate: ['apartment'] },
    );
  }

  async removeFromWishlist(apartmentUuid: string, { uuid }: IAuthContext) {
    const wishlist = await this.wishlistRepository.findOne({
      user: { uuid },
      apartment: { uuid: apartmentUuid },
    });
    if (!wishlist)
      throw new NotFoundException('Apartment not found in wishlist');
    await this.wishlistRepository.nativeDelete({
      user: { uuid },
      apartment: { uuid: apartmentUuid },
    });
    return { message: 'Removed from wishlist', success: true };
  }

  async addToWishlist(apartmentUuid: string, { uuid }: IAuthContext) {
    const apartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
    });
    if (!apartment) throw new NotFoundException(`Apartment not found`);
    const exists = await this.wishlistRepository.findOne({
      user: { uuid },
      apartment: { uuid: apartmentUuid },
    });
    if (exists) throw new ConflictException(`Apartment is in wishlist already`);
    const wishlist = this.wishlistRepository.create({
      uuid: v4(),
      user: this.usersRepository.getReference(uuid),
      apartment: this.apartmentsRepository.getReference(apartmentUuid),
    });
    this.em.persist(wishlist);
    await this.em.flush();
    return { message: 'Added to wishlist', success: true };
  }

  async getApartment(
    apartmentUuid: string,
    userUuid?: string,
  ): Promise<Apartments> {
    const apartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
    });

    let isWishlisted = false;

    if (apartment && userUuid) {
      const wishlistEntry = await this.wishlistRepository.findOne({
        apartment: apartmentUuid,
        user: userUuid,
      });

      isWishlisted = !!wishlistEntry;
    }

    return apartment
      ? ({
          ...apartment,
          isWishlisted,
        } as any)
      : null;
  }

  async fetchApartments(
    filter: ApartmentFilter,
    pagination: PaginationInput,
    search?: string,
    userUuid?: string,
  ) {
    const { page = 1, limit = 20 } = pagination;
    const offset = limit * (page - 1);

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (search) {
      whereClauses.push('a.title LIKE ?');
      params.push(`%${search}%`);
    }

    if (filter?.apartmentType) {
      whereClauses.push('a.apartment_type = ?');
      params.push(filter.apartmentType);
    }

    const whereSql =
      whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    let sql: string;

    if (userUuid) {
      sql = `
      SELECT
        a.*,
        CASE WHEN w.uuid IS NOT NULL THEN true ELSE false END AS isWishlisted
      FROM apartments a
      LEFT JOIN wishlist w
        ON w.apartment_uuid = a.uuid
       AND w.user_uuid = ?
      ${whereSql ? ' ' + whereSql : ''}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
      params.push(userUuid);
    } else {
      sql = `
      SELECT
        a.*,
        false AS isWishlisted
      FROM apartments a
      ${whereSql ? ' ' + whereSql : ''}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
    }

    // Append LIMIT and OFFSET at the end of params
    params.push(Number(limit), Number(offset));

    // Count query params only use filtering (exclude limit/offset and userUuid)
    const countParams = userUuid
      ? params.slice(0, params.length - 3)
      : params.slice(0, params.length - 2);

    const countSql = `
    SELECT COUNT(*) AS total
    FROM apartments a
    ${whereSql ? ' ' + whereSql : ''}
  `;

    const conn = this.em.getConnection();
    const [apartments, totalResult] = await Promise.all([
      conn.execute(sql, params),
      conn.execute(countSql, countParams),
    ]);

    const total = totalResult[0]?.total || 0;

    return buildResponseDataWithPagination(apartments, total, { page, limit });
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
