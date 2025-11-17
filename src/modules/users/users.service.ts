import { EntityManager, EntityRepository, QueryOrder } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Users } from './users.entity';
import { SharedService } from '../shared/shared.service';
import {
  DeactivateAccountDto,
  UpdateUserInfo,
  VerifyBankAccountDto,
} from './users.dto';
import { IAuthContext } from 'src/types';
import axios from 'axios';
import { PaystackConfiguration } from 'src/config/configuration';
import { ConfigType } from '@nestjs/config';
import { UserListQueryDto } from '../admin/admin.dto';
import { Apartments, Bookings } from '../apartments/apartments.entity';

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Users)
    private readonly usersRepository: EntityRepository<Users>,
    @InjectRepository(Bookings)
    private readonly bookingsRepository: EntityRepository<Bookings>,
    @InjectRepository(Apartments)
    private readonly apartmentsRepository: EntityRepository<Apartments>,
    @Inject(PaystackConfiguration.KEY)
    private readonly paystackConfig: ConfigType<typeof PaystackConfiguration>,
    private readonly sharedService: SharedService,
  ) {}

  async getUserWithBookings(userId: string) {
    const user = await this.usersRepository.findOneOrFail({ uuid: userId });
    const bookingsPromise = this.bookingsRepository.find(
      {
        user: { uuid: userId },
        isCancelled: false,
      },
      { populate: ['apartment'], orderBy: { startDate: QueryOrder.DESC } },
    );
    const apartmentsPromise = this.apartmentsRepository.find(
      { createdBy: { uuid: userId } },
      { orderBy: { createdAt: QueryOrder.DESC } },
    );
    const [bookings, apartments] = await Promise.all([
      bookingsPromise,
      apartmentsPromise,
    ]);
    return {
      profile: {
        name: user.fullName,
        email: user.email,
        phone: user.phone,
      },
      bookings: bookings.map((b) => ({
        property: b.apartment?.title,
        location: b.apartment?.city || 'Unknown',
        date: b.startDate,
        amount: b.totalAmount,
        status: b.status,
      })),
      apartments: apartments.map((a) => ({
        uuid: a.uuid,
        title: a.title,
        city: a.city,
        address: a.address,
        published: a.published,
        status: a.status,
        createdAt: a.createdAt,
      })),
    };
  }

  async getPaginatedUsers({
    search,
    page,
    limit,
    sortBy,
    order,
  }: UserListQueryDto) {
    const where = {};
    if (search) {
      Object.assign(where, {
        $or: [
          { fullName: { $like: `%${search}%` } },
          { email: { $ilike: `%${search}%` } },
          { phone: { $ilike: `%${search}%` } },
        ],
      });
    }
    const [data, total] = await this.usersRepository.findAndCount(where, {
      offset: (page - 1) * limit,
      limit,
      orderBy: {
        [sortBy || 'fullName']:
          order?.toUpperCase() === 'DESC' ? QueryOrder.DESC : QueryOrder.ASC,
      },
    });
    return {
      data: data.map((user) => ({
        uuid: user.uuid,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findByEmailOrPhone(emailOrPhone: string) {
    let username: string;
    try {
      username = this.sharedService
        .validatePhoneNumber(emailOrPhone)
        .substring(1);
    } catch (error) {
      username = emailOrPhone;
    } finally {
      return this.usersRepository.findOne({
        $or: [{ email: username }, { phone: username }],
      });
    }
  }

  async updateUserInfo(dto: UpdateUserInfo, { uuid }: IAuthContext) {
    const user = await this.usersRepository.findOne({ uuid });
    if (!user) throw new NotFoundException('User does not exist');
    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.preferredFirstname)
      user.preferredFirstname = dto.preferredFirstname;
    if (dto.phone) {
      const phoneNumber = this.sharedService.validatePhoneNumber(dto.phone);
      dto.phone = phoneNumber.substring(1);
      const isPhoneDuplicate = await this.usersRepository.findOne({
        phone: dto.phone,
        uuid: { $ne: uuid },
      });
      if (isPhoneDuplicate)
        throw new ConflictException('Phone number has already been used');
      user.phone = dto.phone;
      user.phoneVerified = false;
    }
    if (dto.email) {
      const isEmailDuplicate = await this.usersRepository.findOne({
        email: dto.email,
        uuid: { $ne: uuid },
      });
      if (isEmailDuplicate)
        throw new ConflictException('Email has already been used');
      user.email = dto.email;
      user.emailVerified = false;
    }
    if (dto.country) {
      user.country = dto.country;
    }
    if (dto.state) {
      user.state = dto.state;
    }
    if (dto.city) {
      user.city = dto.city;
    }
    if (dto.emergencyContactFullname) {
      user.emergencyContactFullname = dto.emergencyContactFullname;
    }
    if (dto.emergencyContactRelationship) {
      user.emergencyContactRelationship = dto.emergencyContactRelationship;
    }
    if (dto.emergencyContactEmail) {
      user.emergencyContactEmail = dto.emergencyContactEmail;
    }
    if (dto.emergencyContactPhone) {
      user.emergencyContactPhone = dto.emergencyContactPhone;
    }
    if (dto.nin) {
      user.nin = dto.nin;
    }
    if (dto.picture) user.picture = dto.picture;
    await this.em.flush();
  }

  async deactivateAccount(dto: DeactivateAccountDto, { uuid }: IAuthContext) {
    const user = await this.usersRepository.findOne({ uuid });
    if (!user) throw new NotFoundException('User does not exist');
    user.deletedAt = new Date();
    user.deactivationReason = dto.reason;
    await this.em.flush();
  }

  async setActiveStatus(userUuid: string, active: boolean, reason?: string) {
    const user = await this.usersRepository.findOne({ uuid: userUuid });
    if (!user) throw new NotFoundException('User not found');
    user.deletedAt = active ? null : new Date();
    user.deactivationReason = active ? null : reason ?? user.deactivationReason;
    await this.em.flush();
    return { status: true };
  }

  async verifyBankAccount(
    bankAccount: VerifyBankAccountDto,
    { uuid }: IAuthContext,
  ) {
    const userExists = await this.usersRepository.findOne({ uuid });
    if (!userExists) throw new NotFoundException('User not found');
    try {
      const response = await axios.get(
        `${this.paystackConfig.baseUrl}/bank/resolve?account_number=${bankAccount.accountNumber}&bank_code=${bankAccount.bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackConfig.secretKey}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      throw new InternalServerErrorException(error?.response?.data?.message);
    }
  }
}
