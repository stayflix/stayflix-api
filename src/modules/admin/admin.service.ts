import { InjectRepository } from '@mikro-orm/nestjs';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminUser } from './admin.entities';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import bcrypt from 'bcryptjs';
import { IAdminAuthContext } from 'src/types';
import { JwtService } from '@nestjs/jwt';
import { AdminUserDto } from './admin.dto';
import { v4 } from 'uuid';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: EntityRepository<AdminUser>,
    private readonly jwtService: JwtService,
    private readonly em: EntityManager,
  ) {}

  async findUserByEmail(email: string) {
    return this.adminUserRepository.findOne({ email });
  }

  async validateUser(email: string, password: string) {
    const user = await this.findUserByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) return user;
    throw new UnauthorizedException('Invalid details');
  }

  async login(user: AdminUser) {
    const payload: IAdminAuthContext = {
      uuid: user.uuid,
      name: user.fullname,
      email: user.email,
    };
    const userInfo = await this.findUserByEmail(user.email);
    delete userInfo.password;
    delete userInfo.createdAt;
    delete userInfo.updatedAt;
    return {
      status: true,
      data: {
        accessToken: this.jwtService.sign(payload),
        user: userInfo,
      },
    };
  }

  async createUser(user: AdminUserDto) {
    const userExists = await this.adminUserRepository.findOne({
      email: user.email,
    });
    if (userExists)
      throw new ConflictException(
        `User with email: ${user.email} already exists`,
      );
    const hashedPassword = await bcrypt.hash(user.password, 12);
    const adminUserModel = this.adminUserRepository.create({
      uuid: v4(),
      fullname: user.fullname,
      email: user.email,
      password: hashedPassword,
    });
    this.em.persist(adminUserModel);
    await this.em.flush();
    return { status: true };
  }
}
