import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  FilterQuery,
  QueryOrder,
  wrap,
} from '@mikro-orm/core';
import axios from 'axios';
import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PaystackConfiguration } from 'src/config/configuration';
import {
  InitiatePayoutDto,
  ResolveAccountDto,
  SaveBankAccountDto,
} from './payments.dto';
import { UserBankAccount } from './payments.entity';
import { Users } from '../users/users.entity';
import { v4 } from 'uuid';
import { Currencies, IAdminAuthContext, IAuthContext } from 'src/types';
import { PayOut } from '../apartments/apartments.entity';
import { Apartments } from '../apartments/apartments.entity';
import { createHmac } from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly em: EntityManager,
    @Inject(PaystackConfiguration.KEY)
    private readonly paystackConfig: ConfigType<typeof PaystackConfiguration>,
    @InjectRepository(UserBankAccount)
    private readonly bankAccountRepository: EntityRepository<UserBankAccount>,
    @InjectRepository(Users)
    private readonly usersRepository: EntityRepository<Users>,
    @InjectRepository(PayOut)
    private readonly payoutRepository: EntityRepository<PayOut>,
    @InjectRepository(Apartments)
    private readonly apartmentsRepository: EntityRepository<Apartments>,
  ) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.paystackConfig.secretKey}`,
    };
  }

  async fetchBanks() {
    const response = await axios.get(
      `${this.paystackConfig.baseUrl}/bank?currency=NGN`,
      { headers: this.headers },
    );
    return response.data;
  }

  async resolveAccount(dto: ResolveAccountDto) {
    try {
      const response = await axios.get(
        `${this.paystackConfig.baseUrl}/bank/resolve`,
        {
          headers: this.headers,
          params: {
            account_number: dto.accountNumber,
            bank_code: dto.bankCode,
          },
        },
      );
      return response.data;
    } catch (error) {
      throw new InternalServerErrorException(
        error?.response?.data?.message ?? 'Unable to resolve account number',
      );
    }
  }

  async saveBankAccount(dto: SaveBankAccountDto, userCtx: IAuthContext) {
    const user = await this.usersRepository.findOne({ uuid: userCtx.uuid });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const resolved = await this.resolveAccount(dto);
    const resolvedAccountName =
      resolved?.data?.account_name ?? dto.accountName?.trim();

    if (!resolvedAccountName) {
      throw new BadRequestException('Unable to determine account name');
    }

    const recipientResponse = await axios
      .post(
        `${this.paystackConfig.baseUrl}/transferrecipient`,
        {
          type: 'nuban',
          name: resolvedAccountName,
          account_number: dto.accountNumber,
          bank_code: dto.bankCode,
          currency: 'NGN',
        },
        { headers: this.headers },
      )
      .catch((error) => {
        throw new InternalServerErrorException(
          error?.response?.data?.message ??
            'Unable to register payout recipient with Paystack',
        );
      });

    const recipientCode = recipientResponse?.data?.data?.recipient_code;
    if (!recipientCode) {
      throw new InternalServerErrorException(
        'Missing recipient code from Paystack response',
      );
    }

    const existingAccounts = await this.bankAccountRepository.find(
      { user: userCtx.uuid } as FilterQuery<UserBankAccount>,
      {},
    );

    const makeDefault =
      dto.makeDefault !== undefined
        ? dto.makeDefault
        : existingAccounts.length === 0;

    let record = existingAccounts.find(
      (account) => account.accountNumber === dto.accountNumber,
    );

    if (!record) {
      record = this.bankAccountRepository.create({
        uuid: v4(),
        user: this.usersRepository.getReference(userCtx.uuid),
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        accountName: resolvedAccountName,
        recipientCode,
        isDefault: makeDefault,
      });
    } else {
      record.bankCode = dto.bankCode;
      record.bankName = dto.bankName;
      record.accountName = resolvedAccountName;
      record.recipientCode = recipientCode;
      if (dto.makeDefault !== undefined) {
        record.isDefault = dto.makeDefault;
      }
    }

    if (makeDefault) {
      await this.bankAccountRepository.nativeUpdate(
        { user: userCtx.uuid },
        { isDefault: false },
      );
      record.isDefault = true;
    }

    this.em.persist(record);
    await this.em.flush();

    return wrap(record).toObject();
  }

  async fetchUserBankAccounts({ uuid }: IAuthContext) {
    const accounts = await this.bankAccountRepository.find(
      { user: uuid } as FilterQuery<UserBankAccount>,
      {
        orderBy: {
          isDefault: QueryOrder.DESC,
          createdAt: QueryOrder.DESC,
        },
      },
    );
    return accounts.map((account) => wrap(account).toObject());
  }

  async fetchBankAccountsByUser(userUuid: string) {
    const accounts = await this.bankAccountRepository.find(
      { user: userUuid } as FilterQuery<UserBankAccount>,
      {
        orderBy: {
          isDefault: QueryOrder.DESC,
          createdAt: QueryOrder.DESC,
        },
      },
    );
    return accounts.map((account) => wrap(account).toObject());
  }

  private async getDefaultBankAccount(userUuid: string) {
    const account = await this.bankAccountRepository.findOne(
      {
        user: userUuid,
        isDefault: true,
      } as FilterQuery<UserBankAccount>,
      { populate: ['user'] },
    );
    if (!account) {
      throw new BadRequestException(
        'No default bank account configured for this user',
      );
    }
    if (!account.recipientCode) {
      throw new BadRequestException(
        'Bank account is missing a Paystack recipient code',
      );
    }
    return account;
  }

  async initiatePayout(dto: InitiatePayoutDto, admin: IAdminAuthContext) {
    const user = await this.usersRepository.findOne({ uuid: dto.userUuid });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.apartmentUuid) {
      const apartment = await this.apartmentsRepository.findOne(
        { uuid: dto.apartmentUuid },
        { populate: ['createdBy'] },
      );
      if (!apartment) {
        throw new NotFoundException('Apartment not found');
      }
      if (apartment.createdBy?.uuid && apartment.createdBy.uuid !== dto.userUuid) {
        throw new BadRequestException(
          'Apartment is not owned by the selected user',
        );
      }
    }

    const account = await this.getDefaultBankAccount(dto.userUuid);

    const amountKobo = Math.round(Number(dto.amount) * 100);
    if (amountKobo <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const payload = {
      source: 'balance',
      amount: amountKobo,
      currency: 'NGN',
      recipient: account.recipientCode,
      reason:
        dto.narration ??
        `Payout to ${account.accountName || account.accountNumber}`,
      metadata: {
        apartmentUuid: dto.apartmentUuid,
        userUuid: dto.userUuid,
        bankAccountUuid: account.uuid,
        initiatedBy: admin.uuid,
      },
    };

    const transferResponse = await axios
      .post(`${this.paystackConfig.baseUrl}/transfer`, payload, {
        headers: this.headers,
      })
      .catch((error) => {
        throw new InternalServerErrorException(
          error?.response?.data?.message ??
            'Unable to initiate payout with Paystack',
        );
      });

    const transferData = transferResponse?.data?.data;
    if (!transferData) {
      throw new InternalServerErrorException('Invalid Paystack response');
    }

    const payout = this.payoutRepository.create({
      uuid: v4(),
      user: this.usersRepository.getReference(dto.userUuid),
      apartment: dto.apartmentUuid
        ? this.apartmentsRepository.getReference(dto.apartmentUuid)
        : null,
      amount: dto.amount,
      reference: transferData.reference,
      status: transferData.status ?? 'pending',
      transferCode: transferData.transfer_code,
      providerReference: transferData.id
        ? transferData.id.toString()
        : undefined,
      metadata: JSON.stringify(transferData),
      currency: Currencies.NGN,
    });

    this.em.persist(payout);
    await this.em.flush();

    return {
      status: true,
      message: 'Payout initiated',
      data: {
        transferCode: payout.transferCode,
        status: payout.status,
        reference: payout.reference,
      },
    };
  }

  async handlePaystackWebhook(
    payload: any,
    rawBody: string,
    signature: string,
  ) {
    const hmac = createHmac('sha512', this.paystackConfig.secretKey)
      .update(rawBody)
      .digest('hex');

    if (hmac !== signature) {
      throw new ForbiddenException('Invalid Paystack signature');
    }

    const event = payload?.event;
    if (!event) {
      throw new BadRequestException('Invalid webhook payload');
    }

    if (event.startsWith('transfer.')) {
      await this.processTransferEvent(event, payload?.data);
    }

    return { received: true };
  }

  private async processTransferEvent(event: string, data: any) {
    if (!data) {
      return;
    }

    const transferCode = data?.transfer_code;
    const reference = data?.reference;

    let payout = await this.payoutRepository.findOne({
      $or: [
        transferCode ? { transferCode } : null,
        reference ? { reference } : null,
      ].filter(Boolean) as FilterQuery<PayOut>[],
    });

    const status =
      event === 'transfer.success'
        ? 'success'
        : event === 'transfer.failed'
          ? 'failed'
          : data?.status ?? 'pending';

    if (!payout && status === 'success') {
      const metadata = data?.metadata ?? {};
      const recipientCode = data?.recipient?.recipient_code;
      const bankAccount = recipientCode
        ? await this.bankAccountRepository.findOne(
            { recipientCode },
            { populate: ['user'] },
          )
        : null;

      if (!bankAccount) {
        return;
      }

      payout = this.payoutRepository.create({
        uuid: v4(),
        user: bankAccount.user,
        apartment: metadata?.apartmentUuid
          ? this.apartmentsRepository.getReference(metadata.apartmentUuid)
          : null,
        amount: data?.amount ? Number(data.amount) / 100 : 0,
        reference,
        status,
        transferCode,
        providerReference: data?.id ? data.id.toString() : undefined,
        metadata: JSON.stringify(data),
        currency: Currencies.NGN,
      });
      this.em.persist(payout);
      await this.em.flush();
      return;
    }

    if (payout) {
      payout.status = status;
      payout.providerReference = data?.id
        ? data.id.toString()
        : payout.providerReference;
      payout.metadata = JSON.stringify(data);
      payout.reference = payout.reference ?? reference;
      payout.transferCode = payout.transferCode ?? transferCode;
      if (data?.amount) {
        payout.amount = Number(data.amount) / 100;
      }
      await this.em.flush();
    }
  }

  async getPayoutHistoryForOwner(userUuid: string, apartmentUuid?: string) {
    const where: FilterQuery<PayOut> = {
      user: userUuid,
    };
    if (apartmentUuid) {
      where.apartment = apartmentUuid;
    }
    const payouts = await this.payoutRepository.find(where, {
      populate: ['apartment'],
      orderBy: { createdAt: QueryOrder.DESC },
    });

    return payouts.map((payout) => ({
      uuid: payout.uuid,
      amount: payout.amount,
      status: payout.status,
      reference: payout.reference,
      transferCode: payout.transferCode,
      createdAt: payout.createdAt,
      apartment: payout.apartment
        ? {
            uuid: payout.apartment.uuid,
            title: payout.apartment.title,
          }
        : null,
    }));
  }
}
