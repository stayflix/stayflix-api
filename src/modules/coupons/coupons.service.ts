import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  FilterQuery,
  wrap,
} from '@mikro-orm/core';
import { Coupon } from './coupons.entity';
import {
  AssignCouponDto,
  CouponListQuery,
  CreateCouponDto,
  UpdateCouponDto,
  UpdateCouponStatusDto,
  VerifyCouponDto,
} from './coupons.dto';
import { Users } from '../users/users.entity';
import { Apartments } from '../apartments/apartments.entity';
import { v4 } from 'uuid';
import { buildResponseDataWithPagination } from 'src/utils';
import { CouponStatus } from 'src/types';

@Injectable()
export class CouponsService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Coupon)
    private readonly couponRepository: EntityRepository<Coupon>,
    @InjectRepository(Users)
    private readonly usersRepository: EntityRepository<Users>,
    @InjectRepository(Apartments)
    private readonly apartmentsRepository: EntityRepository<Apartments>,
  ) {}

  async createCoupon(dto: CreateCouponDto) {
    const existing = await this.couponRepository.findOne({
      code: dto.code.trim().toUpperCase(),
    });
    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    let assignedUser: Users = null;
    if (dto.assignedTo) {
      assignedUser = await this.usersRepository.findOne({
        uuid: dto.assignedTo,
      });
      if (!assignedUser) {
        throw new NotFoundException('Assigned user not found');
      }
    }

    const coupon = this.couponRepository.create({
      uuid: v4(),
      code: dto.code.trim().toUpperCase(),
      description: dto.description,
      amount: dto.amount,
      remainingAmount: dto.amount,
      status: CouponStatus.ACTIVE,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      assignedTo: assignedUser ?? undefined,
    });

    this.em.persist(coupon);
    await this.em.flush();

    return wrap(coupon).toObject();
  }

  async listCoupons(query: CouponListQuery) {
    const pagination = query.pagination ?? ({} as any);
    const limit = Math.max(Number(pagination.limit ?? 20), 1);
    const page = Math.max(Number(pagination.page ?? 1), 1);
    const where: FilterQuery<Coupon> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.$or = [
        { code: { $like: `%${query.search}%` } },
        { description: { $like: `%${query.search}%` } },
      ];
    }

    const [coupons, total] = await this.couponRepository.findAndCount(where, {
      limit,
      offset: (page - 1) * limit,
      orderBy: { createdAt: 'DESC' },
      populate: ['assignedTo'],
    });

    const data = coupons.map((coupon) => wrap(coupon).toObject());

    return buildResponseDataWithPagination(data, total, { page, limit });
  }

  async getCoupon(uuid: string) {
    const coupon = await this.couponRepository.findOne(
      { uuid },
      { populate: ['assignedTo'] },
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return wrap(coupon).toObject();
  }

  async updateCoupon(uuid: string, dto: UpdateCouponDto) {
    const coupon = await this.couponRepository.findOne({ uuid });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (dto.amount !== undefined) {
      const alreadyUsed = Number(coupon.amount) - Number(coupon.remainingAmount);
      if (dto.amount < alreadyUsed) {
        throw new BadRequestException(
          'New amount cannot be less than the amount already used',
        );
      }
      coupon.remainingAmount = Number(
        (dto.amount - alreadyUsed).toFixed(2),
      );
      coupon.amount = dto.amount;
      if (coupon.remainingAmount <= 0) {
        coupon.status = CouponStatus.EXHAUSTED;
      } else if (coupon.status === CouponStatus.EXHAUSTED) {
        coupon.status = CouponStatus.ACTIVE;
      }
    }

    if (dto.description !== undefined) {
      coupon.description = dto.description;
    }

    if (dto.expiresAt !== undefined) {
      coupon.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    await this.em.flush();
    return wrap(coupon).toObject();
  }

  async updateCouponStatus(uuid: string, dto: UpdateCouponStatusDto) {
    const coupon = await this.couponRepository.findOne({ uuid });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    coupon.status = dto.status;
    await this.em.flush();
    return wrap(coupon).toObject();
  }

  async assignCoupon(uuid: string, dto: AssignCouponDto) {
    const coupon = await this.couponRepository.findOne({ uuid });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const user = await this.usersRepository.findOne({
      uuid: dto.userUuid,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    coupon.assignedTo = user;
    await this.em.flush();
    return wrap(coupon).toObject();
  }

  async unassignCoupon(uuid: string) {
    const coupon = await this.couponRepository.findOne({ uuid });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    coupon.assignedTo = null;
    await this.em.flush();
    return wrap(coupon).toObject();
  }

  async deleteCoupon(uuid: string) {
    const coupon = await this.couponRepository.findOne({ uuid });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    coupon.deletedAt = new Date();
    await this.em.flush();
    return { success: true };
  }

  async verifyCouponForUser(userUuid: string, dto: VerifyCouponDto) {
    const apartment = await this.apartmentsRepository.findOne({
      uuid: dto.apartmentUuid,
    });
    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid booking dates supplied');
    }

    const bookingAmount = this.calculateBookingAmount(apartment, start, end);

    const validation = await this.validateCouponForAmount(
      dto.code,
      userUuid,
      bookingAmount,
    );

    return {
      coupon: wrap(validation.coupon).toObject(),
      discount: validation.discount,
      totalAmount: bookingAmount,
      payableAmount: Math.max(bookingAmount - validation.discount, 0),
      remainingAmountAfterUse: validation.remainingAfter,
    };
  }

  async validateCouponForAmount(
    code: string,
    userUuid: string,
    amount: number,
  ) {
    const coupon = await this.couponRepository.findOne(
      { code: code.trim().toUpperCase() },
      { populate: ['assignedTo'] },
    );
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (coupon.deletedAt) {
      throw new BadRequestException('Coupon is no longer available');
    }

    if (coupon.status === CouponStatus.INACTIVE) {
      throw new BadRequestException('Coupon is inactive');
    }

    if (coupon.status === CouponStatus.EXHAUSTED) {
      throw new BadRequestException('Coupon has been exhausted');
    }

    if (coupon.status === CouponStatus.EXPIRED) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      coupon.status = CouponStatus.EXPIRED;
      await this.em.flush();
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.assignedTo && coupon.assignedTo.uuid !== userUuid) {
      throw new BadRequestException('Coupon is not assigned to this user');
    }

    if (coupon.remainingAmount <= 0) {
      coupon.status = CouponStatus.EXHAUSTED;
      await this.em.flush();
      throw new BadRequestException('Coupon has been exhausted');
    }

    if (amount <= 0) {
      throw new BadRequestException('Invalid booking amount for coupon use');
    }

    const discount = Number(
      Math.min(Number(coupon.remainingAmount), amount).toFixed(2),
    );
    const remainingAfter = Number(
      (Number(coupon.remainingAmount) - discount).toFixed(2),
    );

    return { coupon, discount, remainingAfter };
  }

  async consumeCoupon(couponUuid: string, amountUsed: number) {
    if (!couponUuid) {
      return;
    }
    const coupon = await this.couponRepository.findOne({ uuid: couponUuid });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    coupon.remainingAmount = Number(
      Math.max(Number(coupon.remainingAmount) - amountUsed, 0).toFixed(2),
    );
    if (coupon.remainingAmount <= 0) {
      coupon.status = CouponStatus.EXHAUSTED;
    } else if (coupon.status === CouponStatus.EXHAUSTED) {
      coupon.status = CouponStatus.ACTIVE;
    }

    await this.em.flush();
  }

  private calculateBookingAmount(
    apartment: Apartments,
    start: Date,
    end: Date,
  ) {
    const diffInMs = end.getTime() - start.getTime();
    if (diffInMs <= 0) {
      throw new BadRequestException('End date must be after start date');
    }
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
    return diffInDays * (apartment.weekdayBasePrice || 0);
  }
}
