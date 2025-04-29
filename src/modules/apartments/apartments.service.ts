import { EntityManager, EntityRepository, FindOptions } from '@mikro-orm/core';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApartmentFilter,
  CreateApartmentDto,
  CreateDraftApartmentDto,
  CreateWishlistDto,
} from './apartments.dto';
import { IAuthContext } from 'src/types';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  Apartments,
  Wishlist,
  WishlistedApartments,
} from './apartments.entity';
import { Users } from '../users/users.entity';
import { v4 } from 'uuid';
import { PaginationInput } from 'src/base/dto';
import { buildResponseDataWithPagination } from 'src/utils';

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
  ) {}

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
}
