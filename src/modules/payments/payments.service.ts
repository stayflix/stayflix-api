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
  FinalizeTransferDto,
  InitiatePayoutDto,
  ResolveAccountDto,
  SaveBankAccountDto,
} from './payments.dto';
import { UserBankAccount } from './payments.entity';
import { Users } from '../users/users.entity';
import { v4 } from 'uuid';
import { Currencies, IAdminAuthContext, IAuthContext } from 'src/types';
import {
  PayOut,
  PayOutBatch,
  Apartments,
  Bookings,
  BookingStatus,
} from '../apartments/apartments.entity';
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
    @InjectRepository(PayOutBatch)
    private readonly payoutBatchRepository: EntityRepository<PayOutBatch>,
    @InjectRepository(Apartments)
    private readonly apartmentsRepository: EntityRepository<Apartments>,
    @InjectRepository(Bookings)
    private readonly bookingsRepository: EntityRepository<Bookings>,
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

  async getPendingPaymentsForAllUsers() {
    const bookings = await this.bookingsRepository.find(
      {
        isPaidOut: false,
        isCancelled: false,
      } as FilterQuery<Bookings>,
      { populate: ['apartment', 'apartment.createdBy'] },
    );

    const userMap = new Map<string, {
      user: { uuid: string; fullName: string; email: string; phone: string };
      apartments: Map<string, { apartment: { uuid: string; title: string }; amount: number; count: number }>;
    }>();

    for (const booking of bookings) {
      const apt = booking.apartment;
      if (!apt) continue;
      const owner = apt.createdBy;
      if (!owner) continue;

      if (!userMap.has(owner.uuid)) {
        userMap.set(owner.uuid, {
          user: {
            uuid: owner.uuid,
            fullName: owner.fullName,
            email: owner.email,
            phone: owner.phone,
          },
          apartments: new Map(),
        });
      }

      const userEntry = userMap.get(owner.uuid)!;

      if (!userEntry.apartments.has(apt.uuid)) {
        userEntry.apartments.set(apt.uuid, {
          apartment: { uuid: apt.uuid, title: apt.title },
          amount: 0,
          count: 0,
        });
      }

      const aptEntry = userEntry.apartments.get(apt.uuid)!;
      aptEntry.amount += Number(booking.totalAmount ?? 0);
      aptEntry.count += 1;
    }

    const users = Array.from(userMap.values()).map(({ user, apartments }) => {
      const aptItems = Array.from(apartments.values()).map(({ apartment, amount, count }) => ({
        apartment,
        pendingBookingsCount: count,
        totalPendingAmount: amount,
      }));
      return {
        user,
        apartments: aptItems,
        total: aptItems.reduce((sum, i) => sum + i.totalPendingAmount, 0),
      };
    });

    return {
      users,
      grandTotal: users.reduce((sum, u) => sum + u.total, 0),
    };
  }

  async getPendingPaymentsForUser(userUuid: string) {
    const apartments = await this.apartmentsRepository.find(
      { createdBy: userUuid } as FilterQuery<Apartments>,
    );

    if (!apartments.length) return { items: [], total: 0 };

    const apartmentMap = new Map(apartments.map((a) => [a.uuid, a]));
    const apartmentUuids = apartments.map((a) => a.uuid);

    const bookings = await this.bookingsRepository.find({
      apartment: { $in: apartmentUuids },
      isPaidOut: false,
      isCancelled: false,
    } as FilterQuery<Bookings>);

    const grouped = new Map<string, { amount: number; count: number }>();
    for (const booking of bookings) {
      const apUuid = booking.apartment?.uuid;
      if (!apUuid) continue;
      if (!grouped.has(apUuid)) grouped.set(apUuid, { amount: 0, count: 0 });
      const entry = grouped.get(apUuid)!;
      entry.amount += Number(booking.totalAmount ?? 0);
      entry.count += 1;
    }

    const items = Array.from(grouped.entries()).map(([apUuid, data]) => {
      const apt = apartmentMap.get(apUuid)!;
      return {
        apartment: { uuid: apt.uuid, title: apt.title },
        pendingBookingsCount: data.count,
        totalPendingAmount: data.amount,
      };
    });

    return {
      items,
      total: items.reduce((sum, i) => sum + i.totalPendingAmount, 0),
    };
  }

  async initiatePayoutAll(userUuid: string, admin: IAdminAuthContext) {
    const user = await this.usersRepository.findOne({ uuid: userUuid });
    if (!user) throw new NotFoundException('User not found');

    const { items, total } = await this.getPendingPaymentsForUser(userUuid);

    if (!items.length) {
      throw new BadRequestException('No pending payments found for this user');
    }

    if (total <= 0) {
      throw new BadRequestException('Total pending amount is zero');
    }

    const account = await this.getDefaultBankAccount(userUuid);
    const amountKobo = Math.round(total * 100);

    const payload = {
      source: 'balance',
      amount: amountKobo,
      currency: 'NGN',
      recipient: account.recipientCode,
      reason: `Batch payout to ${account.accountName || account.accountNumber}`,
      metadata: {
        userUuid,
        bankAccountUuid: account.uuid,
        initiatedBy: admin.uuid,
        isBatch: true,
        apartmentUuids: items.map((i) => i.apartment.uuid),
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

    const batch = this.payoutBatchRepository.create({
      uuid: v4(),
      user: this.usersRepository.getReference(userUuid),
      totalAmount: total,
      status: transferData.status ?? 'pending',
      transferCode: transferData.transfer_code,
      reference: transferData.reference,
      providerReference: transferData.id ? transferData.id.toString() : undefined,
      metadata: JSON.stringify(transferData),
      currency: Currencies.NGN,
    });

    this.em.persist(batch);

    for (const item of items) {
      const payout = this.payoutRepository.create({
        uuid: v4(),
        user: this.usersRepository.getReference(userUuid),
        apartment: this.apartmentsRepository.getReference(item.apartment.uuid),
        amount: item.totalPendingAmount,
        status: transferData.status ?? 'pending',
        currency: Currencies.NGN,
        batch,
      });
      this.em.persist(payout);
    }

    await this.em.flush();

    return {
      status: true,
      message: 'Batch payout initiated',
      data: {
        batchUuid: batch.uuid,
        transferCode: batch.transferCode,
        status: batch.status,
        reference: batch.reference,
        totalAmount: total,
        apartmentsCount: items.length,
      },
    };
  }

  async finalizeBatchPayout(batchUuid: string, dto: FinalizeTransferDto) {
    const batch = await this.payoutBatchRepository.findOne({ uuid: batchUuid });
    if (!batch) throw new NotFoundException('Batch payout not found');
    if (!batch.transferCode) {
      throw new BadRequestException('Batch payout has no transfer code');
    }
    if (batch.status === 'success' || batch.status === 'failed') {
      throw new BadRequestException(
        `Batch payout is already ${batch.status}; no OTP required`,
      );
    }

    const transferData = await this.finalizePaystackTransfer(
      batch.transferCode,
      dto.otp,
    );

    batch.status = transferData?.status ?? batch.status;
    batch.providerReference = transferData?.id
      ? transferData.id.toString()
      : batch.providerReference;
    batch.metadata = JSON.stringify(transferData);

    const batchPayouts = await this.payoutRepository.find(
      { batch: batch.uuid } as FilterQuery<PayOut>,
    );
    for (const p of batchPayouts) {
      p.status = transferData?.status ?? p.status;
    }

    await this.em.flush();

    return {
      status: true,
      message: 'Batch payout finalized',
      data: {
        batchUuid: batch.uuid,
        transferCode: batch.transferCode,
        status: batch.status,
        reference: batch.reference,
      },
    };
  }

  async finalizeSinglePayout(payoutUuid: string, dto: FinalizeTransferDto) {
    const payout = await this.payoutRepository.findOne({ uuid: payoutUuid });
    if (!payout) throw new NotFoundException('Payout not found');
    if (!payout.transferCode) {
      throw new BadRequestException('Payout has no transfer code');
    }
    if (payout.status === 'success' || payout.status === 'failed') {
      throw new BadRequestException(
        `Payout is already ${payout.status}; no OTP required`,
      );
    }

    const transferData = await this.finalizePaystackTransfer(
      payout.transferCode,
      dto.otp,
    );

    payout.status = transferData?.status ?? payout.status;
    payout.providerReference = transferData?.id
      ? transferData.id.toString()
      : payout.providerReference;
    payout.metadata = JSON.stringify(transferData);

    await this.em.flush();

    return {
      status: true,
      message: 'Payout finalized',
      data: {
        payoutUuid: payout.uuid,
        transferCode: payout.transferCode,
        status: payout.status,
        reference: payout.reference,
      },
    };
  }

  async resendBatchPayoutOtp(batchUuid: string) {
    const batch = await this.payoutBatchRepository.findOne({ uuid: batchUuid });
    if (!batch) throw new NotFoundException('Batch payout not found');
    if (!batch.transferCode) {
      throw new BadRequestException('Batch payout has no transfer code');
    }
    return this.resendPaystackOtp(batch.transferCode);
  }

  async resendSinglePayoutOtp(payoutUuid: string) {
    const payout = await this.payoutRepository.findOne({ uuid: payoutUuid });
    if (!payout) throw new NotFoundException('Payout not found');
    if (!payout.transferCode) {
      throw new BadRequestException('Payout has no transfer code');
    }
    return this.resendPaystackOtp(payout.transferCode);
  }

  private async finalizePaystackTransfer(transferCode: string, otp: string) {
    const response = await axios
      .post(
        `${this.paystackConfig.baseUrl}/transfer/finalize_transfer`,
        { transfer_code: transferCode, otp },
        { headers: this.headers },
      )
      .catch((error) => {
        throw new InternalServerErrorException(
          error?.response?.data?.message ??
            'Unable to finalize Paystack transfer',
        );
      });
    const data = response?.data?.data;
    if (!data) {
      throw new InternalServerErrorException(
        'Invalid Paystack finalize response',
      );
    }
    return data;
  }

  private async resendPaystackOtp(transferCode: string) {
    const response = await axios
      .post(
        `${this.paystackConfig.baseUrl}/transfer/resend_otp`,
        { transfer_code: transferCode, reason: 'transfer' },
        { headers: this.headers },
      )
      .catch((error) => {
        throw new InternalServerErrorException(
          error?.response?.data?.message ?? 'Unable to resend OTP',
        );
      });
    return {
      status: true,
      message: response?.data?.message ?? 'OTP resent',
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
    if (!data) return;

    const transferCode = data?.transfer_code;
    const reference = data?.reference;

    const status =
      event === 'transfer.success'
        ? 'success'
        : event === 'transfer.failed'
          ? 'failed'
          : data?.status ?? 'pending';

    // Check for a batch payout first
    const batch = await this.payoutBatchRepository.findOne({
      $or: [
        transferCode ? { transferCode } : null,
        reference ? { reference } : null,
      ].filter(Boolean) as FilterQuery<PayOutBatch>[],
    });

    if (batch) {
      batch.status = status;
      batch.providerReference = data?.id ? data.id.toString() : batch.providerReference;
      batch.metadata = JSON.stringify(data);
      batch.reference = batch.reference ?? reference;
      batch.transferCode = batch.transferCode ?? transferCode;
      if (data?.amount) batch.totalAmount = Number(data.amount) / 100;

      const batchPayouts = await this.payoutRepository.find(
        { batch: batch.uuid } as FilterQuery<PayOut>,
      );

      for (const p of batchPayouts) {
        p.status = status;
      }

      if (this.isSuccessStatus(status)) {
        await this.markBatchApartmentsAsPaid(batch.uuid);
      }

      await this.em.flush();
      return;
    }

    // Single payout flow
    let payout = await this.payoutRepository.findOne({
      $or: [
        transferCode ? { transferCode } : null,
        reference ? { reference } : null,
      ].filter(Boolean) as FilterQuery<PayOut>[],
    });

    if (!payout && status === 'success') {
      const metadata = data?.metadata ?? {};
      const recipientCode = data?.recipient?.recipient_code;
      const bankAccount = recipientCode
        ? await this.bankAccountRepository.findOne(
            { recipientCode },
            { populate: ['user'] },
          )
        : null;

      if (!bankAccount) return;

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
      payout.providerReference = data?.id ? data.id.toString() : payout.providerReference;
      payout.metadata = JSON.stringify(data);
      payout.reference = payout.reference ?? reference;
      payout.transferCode = payout.transferCode ?? transferCode;
      if (data?.amount) payout.amount = Number(data.amount) / 100;
      await this.em.flush();
    }
  }

  private isSuccessStatus(status?: string | null) {
    if (!status) return false;
    const s = status.toString().toLowerCase();
    return s === 'success' || s === 'successful' || s === 'completed';
  }

  private async markBatchApartmentsAsPaid(batchUuid: string) {
    const rows = await this.em
      .getConnection()
      .execute<{ apartment: string | null }[]>(
        'select distinct `apartment` from `pay_outs` where `batch` = ? and `apartment` is not null',
        [batchUuid],
      );

    const apartmentUuids = rows
      .map((r) => r.apartment)
      .filter((uuid): uuid is string => Boolean(uuid));

    if (!apartmentUuids.length) return 0;

    const result = await this.bookingsRepository.nativeUpdate(
      {
        apartment: { $in: apartmentUuids },
        isPaidOut: false,
        isCancelled: false,
        deletedAt: null,
      } as any,
      { isPaidOut: true },
    );

    return typeof result === 'number' ? result : apartmentUuids.length;
  }

  async reconcileBatchPayout(batchUuid: string) {
    const batch = await this.payoutBatchRepository.findOne({ uuid: batchUuid });
    if (!batch) throw new NotFoundException('Batch payout not found');
    if (!this.isSuccessStatus(batch.status)) {
      throw new BadRequestException(
        `Batch status is "${batch.status}". Only successful batches can be reconciled.`,
      );
    }

    const bookingsUpdated = await this.markBatchApartmentsAsPaid(batch.uuid);

    return {
      status: true,
      message: 'Batch payout reconciled',
      data: {
        batchUuid: batch.uuid,
        bookingsMarkedPaid: bookingsUpdated,
      },
    };
  }

  async getPayoutTransactions(userUuid: string) {
    const [batches, singlePayouts] = await Promise.all([
      this.payoutBatchRepository.find(
        { user: userUuid } as FilterQuery<PayOutBatch>,
        {
          populate: ['payouts', 'payouts.apartment'],
          orderBy: { createdAt: QueryOrder.DESC },
        },
      ),
      this.payoutRepository.find(
        { user: userUuid, batch: null } as FilterQuery<PayOut>,
        {
          populate: ['apartment'],
          orderBy: { createdAt: QueryOrder.DESC },
        },
      ),
    ]);

    const batchItems = batches.map((batch) => ({
      type: 'batch' as const,
      uuid: batch.uuid,
      totalAmount: batch.totalAmount,
      status: batch.status,
      reference: batch.reference,
      transferCode: batch.transferCode,
      createdAt: batch.createdAt,
      apartments: batch.payouts.getItems().map((p) => ({
        uuid: p.apartment?.uuid ?? null,
        title: p.apartment?.title ?? null,
        amount: p.amount,
      })),
    }));

    const singleItems = singlePayouts.map((payout) => ({
      type: 'single' as const,
      uuid: payout.uuid,
      amount: payout.amount,
      status: payout.status,
      reference: payout.reference,
      transferCode: payout.transferCode,
      createdAt: payout.createdAt,
      apartment: payout.apartment
        ? { uuid: payout.apartment.uuid, title: payout.apartment.title }
        : null,
    }));

    const transactions = [...batchItems, ...singleItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { transactions };
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
