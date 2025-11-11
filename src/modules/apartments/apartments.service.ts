import {
  EntityManager,
  EntityRepository,
  QueryOrder,
  wrap,
} from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
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
  CreateReviewDto,
  SubmitFeedbackDto,
} from './apartments.dto';
import {
  ApartmentStatus,
  CouponStatus,
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
  Feedback,
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
import { CouponsService } from '../coupons/coupons.service';
import { Coupon } from '../coupons/coupons.entity';

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
    @InjectRepository(Feedback)
    private readonly feedbackRepository: EntityRepository<Feedback>,
    @Inject(PaystackConfiguration.KEY)
    private readonly paystackConfig: ConfigType<typeof PaystackConfiguration>,
    private readonly couponsService: CouponsService,
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
      populate: ['apartment', 'user', 'coupon'],
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
      couponDiscount: b.couponDiscount,
      couponCode: b.coupon?.code ?? null,
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
    { startDate, endDate, transactionId, couponCode }: BookApartmentDto,
    { uuid }: IAuthContext,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid booking dates supplied');
    }

    if (!transactionId && !couponCode) {
      throw new BadRequestException(
        'Provide a payment reference or coupon code to complete booking',
      );
    }

    const apartment = await this.findApartmentOrThrow(apartmentUuid);
    if (!apartment.published) {
      throw new BadRequestException('Apartment not available');
    }

    const totalAmount = this.calculateTotalAmount(apartment, start, end);
    let couponEntity: Coupon | null = null;
    let couponDiscount = 0;
    let couponRemainingAfter = 0;

    if (couponCode) {
      const validation = await this.couponsService.validateCouponForAmount(
        couponCode,
        uuid,
        totalAmount,
      );
      couponEntity = validation.coupon;
      couponDiscount = validation.discount;
      couponRemainingAfter = validation.remainingAfter;
    }

    const outstandingAmount = Number(
      Math.max(totalAmount - couponDiscount, 0).toFixed(2),
    );

    const conflictingBooking = await this.bookingsRepository.findOne({
      apartment: { uuid: apartment.uuid },
      isCancelled: false,
      $or: [
        {
          startDate: { $lte: end },
          endDate: { $gte: start },
        },
      ],
    });
    if (conflictingBooking) {
      throw new ConflictException(
        'Apartment already booked for selected dates',
      );
    }

    let paymentData: any = null;
    let paymentModel: Payment | null = null;
    let paymentUuid: string | null = null;

    if (transactionId) {
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
          const paystackResponse = error.response;
          if (paystackResponse) {
            const { status } = paystackResponse;
            const message =
              paystackResponse.data?.message ??
              paystackResponse.data?.status ??
              paystackResponse.statusText ??
              'Paystack verification failed';
            throw new HttpException(message, status);
          }
          throw new InternalServerErrorException(
            `An error occurred while trying to verify the transaction with paystack. Error: ${error}`,
          );
        });
      paymentData = transResponse.data.data;
      if (paymentData.status.toLowerCase() !== 'success') {
        throw new ForbiddenException(`Transaction was not successful`);
      }
      const paidAmount = Number(paymentData.amount) / 100;
      const amountToCompare = Number(outstandingAmount.toFixed(2));
      if (Number(paidAmount.toFixed(2)) !== amountToCompare) {
        throw new ForbiddenException(
          `Amount paid must match the outstanding booking balance`,
        );
      }

      paymentUuid = v4();
      paymentModel = this.paymentRepository.create({
        uuid: paymentUuid,
        transactionId: transactionId.toString(),
        metadata: JSON.stringify(paymentData),
        type: PaymentType.INCOMING,
        amount: paidAmount,
        channel: paymentData.paymentMethod,
        status: 'success',
        currency: Currencies.NGN,
      });
    } else if (outstandingAmount > 0) {
      throw new BadRequestException(
        'Payment reference is required for the outstanding balance',
      );
    }

    const booking = this.bookingsRepository.create({
      uuid: v4(),
      apartment: this.apartmentsRepository.getReference(apartmentUuid),
      payment:
        paymentModel && paymentUuid
          ? this.paymentRepository.getReference(paymentUuid)
          : null,
      user: this.usersRepository.getReference(uuid),
      startDate: start,
      endDate: end,
      reservationType: apartment.reservationType,
      totalAmount,
      coupon: couponEntity ?? undefined,
      couponDiscount,
    });
    this.em.persist(booking);
    if (paymentModel) {
      this.em.persist(paymentModel);
    }
    if (couponEntity) {
      couponEntity.remainingAmount = couponRemainingAfter;
      couponEntity.status =
        couponRemainingAfter <= 0
          ? CouponStatus.EXHAUSTED
          : CouponStatus.ACTIVE;
    }
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
    const diffInMs = end.getTime() - start.getTime();
    if (diffInMs <= 0) {
      throw new BadRequestException('End date must be after start date');
    }
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
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

  async fetchMyBookings(
    pagination: PaginationInput = {} as PaginationInput,
    { uuid }: IAuthContext,
  ) {
    const { page = 1, limit = 20, orderBy, orderDir } = pagination;
    const [bookings, total] = await this.bookingsRepository.findAndCount(
      {
        user: { uuid },
        isCancelled: false,
      },
      {
        populate: ['apartment', 'coupon'],
        limit,
        offset: limit * (page - 1),
        orderBy: orderBy
          ? { [orderBy]: orderDir || QueryOrder.DESC }
          : { startDate: QueryOrder.DESC },
      },
    );

    const data = bookings.map((booking) => ({
      uuid: booking.uuid,
      startDate: booking.startDate,
      endDate: booking.endDate,
      totalAmount: booking.totalAmount,
      couponDiscount: booking.couponDiscount,
      couponCode: booking.coupon?.code ?? null,
      status: booking.status,
      reservationType: booking.reservationType,
      isPaidOut: booking.isPaidOut,
      isCancelled: booking.isCancelled,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      apartment: booking.apartment
        ? {
            uuid: booking.apartment.uuid,
            title: booking.apartment.title,
            address: booking.apartment.address,
            city: booking.apartment.city,
            apartmentType: booking.apartment.apartmentType,
            photos: booking.apartment.photos,
          }
        : null,
    }));

    return buildResponseDataWithPagination(data, total, { page, limit });
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
    const apartment = await this.findApartmentOrThrow(apartmentUuid);
    let isWishlisted = false;

    if (apartment && userUuid) {
      const wishlistEntry = await this.wishlistRepository.findOne({
        apartment: apartmentUuid,
        user: userUuid,
      });

      isWishlisted = !!wishlistEntry;
    }

    return {
      ...wrap(apartment).toObject(),
      isWishlisted,
    } as Apartments;
  }

  private async findApartmentOrThrow(uuid: string): Promise<Apartments> {
    const apartment = await this.apartmentsRepository.findOne({ uuid });
    if (!apartment) throw new NotFoundException('Apartment not found');
    return apartment;
  }

  async fetchApartments(
    filter: ApartmentFilter,
    pagination: PaginationInput,
    search?: string,
    userUuid?: string,
  ) {
    const viewerUuid =
      userUuid && userUuid !== 'undefined' && userUuid !== 'null'
        ? userUuid
        : undefined;
    const { page = 1, limit = 20 } = pagination;
    const offset = limit * (page - 1);

    const whereClauses: string[] = [];
    const whereParams: any[] = [];
    const locationFilter = filter?.location?.trim();
    const cityFilter = filter?.city?.trim();
    const countryFilter = filter?.country?.trim();

    if (search) {
      whereClauses.push('a.title LIKE ?');
      whereParams.push(`%${search}%`);
    }

    if (filter?.apartmentType) {
      whereClauses.push('a.apartment_type = ?');
      whereParams.push(filter.apartmentType);
    }

    if (locationFilter) {
      whereClauses.push(
        '(LOWER(a.city) LIKE ? OR LOWER(a.address) LIKE ? OR LOWER(a.country) LIKE ?)',
      );
      const locationLike = `%${locationFilter.toLowerCase()}%`;
      whereParams.push(locationLike, locationLike, locationLike);
    }

    if (cityFilter) {
      whereClauses.push('LOWER(a.city) = ?');
      whereParams.push(cityFilter.toLowerCase());
    }

    if (countryFilter) {
      whereClauses.push('LOWER(a.country) = ?');
      whereParams.push(countryFilter.toLowerCase());
    }

    if (viewerUuid) {
      whereClauses.push('(a.created_by IS NULL OR a.created_by <> ?)');
      whereParams.push(viewerUuid);
    }

    const whereSql =
      whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    let sql: string;

    if (viewerUuid) {
      sql = `
      SELECT
        a.*,
        CASE WHEN w.uuid IS NOT NULL THEN true ELSE false END AS isWishlisted
      FROM apartments a
      LEFT JOIN wishlist w
        ON w.apartment = a.uuid
       AND w.user = ?
      ${whereSql ? ' ' + whereSql : ''}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
      // params handled separately below
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

    const selectParams = [
      ...(viewerUuid ? [viewerUuid] : []),
      ...whereParams,
      Number(limit),
      Number(offset),
    ];

    // Count query params only use filtering (exclude limit/offset and userUuid join param)
    const countParams = [...whereParams];

    const countSql = `
    SELECT COUNT(*) AS total
    FROM apartments a
    ${whereSql ? ' ' + whereSql : ''}
  `;

    const conn = this.em.getConnection();
    const [apartments, totalResult] = await Promise.all([
      conn.execute(sql, selectParams),
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

  async submitReview(
    apartmentUuid: string,
    dto: CreateReviewDto,
    { uuid }: IAuthContext,
  ) {
    const apartment = await this.findApartmentOrThrow(apartmentUuid);
    const bookingWhere: any = {
      apartment: apartmentUuid,
      user: uuid,
      isCancelled: false,
    };
    if (dto.bookingUuid) {
      bookingWhere.uuid = dto.bookingUuid;
    }

    const booking = await this.bookingsRepository.findOne(bookingWhere, {
      populate: ['apartment'],
      orderBy: { createdAt: QueryOrder.DESC },
    });
    if (!booking) {
      throw new ForbiddenException(
        'You can only review apartments you have booked',
      );
    }

    let review = await this.em.findOne(ApartmentReviews, {
      booking: booking.uuid,
    });
    if (!review) {
      review = this.em.create(ApartmentReviews, {
        uuid: v4(),
        apartment: this.apartmentsRepository.getReference(apartment.uuid),
        user: this.usersRepository.getReference(uuid),
        booking: this.bookingsRepository.getReference(booking.uuid),
        rating: dto.rating,
        review: dto.review,
      });
    } else {
      review.rating = dto.rating;
      review.review = dto.review;
    }

    this.em.persist(review);
    await this.em.flush();
    await this.recalculateApartmentRating(apartmentUuid);

    return { status: true, message: 'Review submitted successfully' };
  }

  private async recalculateApartmentRating(apartmentUuid: string) {
    const [reviews, total] = await this.em.findAndCount(ApartmentReviews, {
      apartment: apartmentUuid,
    });

    const totalRating = reviews.reduce(
      (acc, current) => acc + (Number(current.rating) || 0),
      0,
    );
    const avgRating =
      total === 0 ? 0 : Number((totalRating / Math.max(total, 1)).toFixed(2));

    const apartment = await this.findApartmentOrThrow(apartmentUuid);
    apartment.avgRating = avgRating;
    await this.em.flush();
  }

  async getPublicApartmentReviews(
    apartmentUuid: string,
    pagination: PaginationInput = {} as PaginationInput,
  ) {
    await this.findApartmentOrThrow(apartmentUuid);
    const { page = 1, limit = 20 } = pagination;
    const [reviews, total] = await this.em.findAndCount(
      ApartmentReviews,
      { apartment: apartmentUuid },
      {
        populate: ['user'],
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        offset: (page - 1) * limit,
      },
    );

    const data = reviews.map((review) => ({
      uuid: review.uuid,
      rating: review.rating,
      comment: review.review,
      createdAt: review.createdAt,
      user: review.user
        ? { uuid: review.user.uuid, fullName: review.user.fullName }
        : null,
    }));

    return buildResponseDataWithPagination(data, total, { page, limit });
  }

  async getOwnerApartmentReviews(
    apartmentUuid: string,
    pagination: PaginationInput = {} as PaginationInput,
    { uuid }: IAuthContext,
  ) {
    const apartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
      createdBy: { uuid },
    });
    if (!apartment) {
      throw new ForbiddenException('You do not own this apartment');
    }
    const { page = 1, limit = 20 } = pagination;
    const [reviews, total] = await this.em.findAndCount(
      ApartmentReviews,
      { apartment: apartmentUuid },
      {
        populate: ['user', 'booking'],
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        offset: (page - 1) * limit,
      },
    );

    const data = reviews.map((review) => ({
      uuid: review.uuid,
      rating: review.rating,
      comment: review.review,
      createdAt: review.createdAt,
      guest: review.user
        ? { uuid: review.user.uuid, fullName: review.user.fullName }
        : null,
      bookingUuid: review.booking?.uuid ?? null,
    }));

    return buildResponseDataWithPagination(data, total, { page, limit });
  }

  async getApartmentBookingHistory(
    apartmentUuid: string,
    pagination: PaginationInput = {} as PaginationInput,
    { uuid }: IAuthContext,
  ) {
    const apartment = await this.apartmentsRepository.findOne({
      uuid: apartmentUuid,
      createdBy: { uuid },
    });
    if (!apartment) {
      throw new ForbiddenException('You do not own this apartment');
    }

    const { page = 1, limit = 20 } = pagination;
    const [bookings, total] = await this.bookingsRepository.findAndCount(
      { apartment: apartmentUuid },
      {
        populate: ['user', 'coupon'],
        orderBy: { createdAt: QueryOrder.DESC },
        limit,
        offset: (page - 1) * limit,
      },
    );

    const data = bookings.map((booking) => ({
      uuid: booking.uuid,
      guest: booking.user
        ? { uuid: booking.user.uuid, fullName: booking.user.fullName }
        : null,
      startDate: booking.startDate,
      endDate: booking.endDate,
      status: booking.status,
      totalAmount: booking.totalAmount,
      couponDiscount: booking.couponDiscount,
      couponCode: booking.coupon?.code ?? null,
      createdAt: booking.createdAt,
    }));

    return buildResponseDataWithPagination(data, total, { page, limit });
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
    entity.city = dto.city;
    entity.country = dto.country;
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
      city: dto.city,
      country: dto.country,
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
    if (!dto) {
      throw new BadRequestException('No update payload provided');
    }

    const updates = Object.entries(dto).reduce(
      (acc, [key, value]) => {
        if (value !== undefined) {
          (acc as any)[key] = value;
        }
        return acc;
      },
      {} as Partial<UpdateApartmentDto>,
    );

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No update payload provided');
    }

    const apt = await this.findApartmentOrThrow(uuid);
    this.em.assign(apt, updates);
    await this.em.flush();
    return apt;
  }

  async updateApartmentStatus(uuid: string, status: ApartmentStatus) {
    const apt = await this.findApartmentOrThrow(uuid);
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
    const apartment = await this.findApartmentOrThrow(uuid);

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

  async submitFeedback(
    { about, topic, details }: SubmitFeedbackDto,
    { uuid }: IAuthContext,
  ) {
    const feedback = this.feedbackRepository.create({
      uuid: v4(),
      about,
      topic,
      details,
      user: this.usersRepository.getReference(uuid),
    });
    this.em.persist(feedback);
    await this.em.flush();
    return {
      status: true,
      message: 'Feedback submitted successfully',
      data: { feedbackUuid: feedback.uuid },
    };
  }

  async getFeedback() {
    const feedbacks = await this.feedbackRepository.find(
      {},
      {
        populate: ['user'],
        orderBy: { createdAt: QueryOrder.DESC },
      },
    );

    return feedbacks.map((item) => ({
      uuid: item.uuid,
      about: item.about,
      topic: item.topic,
      details: item.details,
      createdAt: item.createdAt,
      user: item.user
        ? {
            uuid: item.user.uuid,
            fullName: item.user.fullName,
            email: item.user.email,
          }
        : null,
    }));
  }
}
