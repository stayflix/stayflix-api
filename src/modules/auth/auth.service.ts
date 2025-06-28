import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BlacklistedTokens, OTP, Users } from '../users/users.entity';
import { SharedService } from '../shared/shared.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthConfiguration } from 'src/config/configuration';
import { ConfigType } from '@nestjs/config';
import {
  ChangePasswordDto,
  LogoutDto,
  NewResetPasswordDto,
  ResetPasswordDto,
  SendOtpDto,
  SignupStepOneDto,
  SignupStepTwoDto,
  VerifyOtpDto,
} from './auth.dto';
import { v4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { generateOtp } from 'src/utils';
import { UsersService } from '../users/users.service';
import { IAuthContext, OTPActionType, RegistrationType } from 'src/types';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Users)
    private readonly usersRepository: EntityRepository<Users>,
    @InjectRepository(OTP)
    private readonly otpRepository: EntityRepository<OTP>,
    @InjectRepository(BlacklistedTokens)
    private readonly blacklistedTokensRepository: EntityRepository<BlacklistedTokens>,
    private readonly sharedService: SharedService,
    private readonly jwtService: JwtService,
    @Inject(JwtAuthConfiguration.KEY)
    private readonly jwtConfig: ConfigType<typeof JwtAuthConfiguration>,
    private readonly usersService: UsersService,
  ) {}

  async signupStepOne(user: SignupStepOneDto) {
    const existingUser = await this.usersRepository.findOne({
      email: user.email,
    });
    if (existingUser) {
      throw new ConflictException(
        `User with email: ${user.email} already exist`,
      );
    }
    const hashedPassword = await bcrypt.hash(user.password, 12);
    const userUuid = v4();
    const userModel = this.usersRepository.create({
      uuid: userUuid,
      email: user.email,
      password: hashedPassword,
      registrationType: RegistrationType.WEB,
    });
    this.em.persist(userModel);
    await this.em.flush();
    return userUuid;
  }

  async signupStepTwo(user: SignupStepTwoDto) {
    const userExists = await this.usersRepository.findOne({ uuid: user.uuid });
    if (!userExists) throw new NotFoundException('User not found');
    const phoneNumber = this.sharedService.validatePhoneNumber(user.phone);
    user.phone = phoneNumber.substring(1);
    const existingUser = await this.usersRepository.findOne({
      phone: user.phone,
    });
    if (existingUser) {
      throw new ConflictException(
        `User with phone: ${user.phone.substring(3)} already exist`,
      );
    }
    const pinId = nanoid();
    const otp = generateOtp();
    await this.sharedService.sendOtp(otp, user.phone);
    await this.em.transactional(async (em) => {
      const otpModel = this.otpRepository.create({ otp, pinId, uuid: v4() });
      userExists.fullName = user.fullName;
      userExists.phone = user.phone;
      userExists.country = user.country;
      userExists.state = user.state;
      userExists.userType = user.userType;
      if (user.picture) userExists.picture = user.picture;
      em.persist(otpModel);
      await em.flush();
    });
    return { pinId, uuid: userExists.uuid };
  }

  async validateUser(emailOrPhone: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailOrPhone(emailOrPhone);
    if (!user) throw new NotFoundException('User not found');
    if (!user.password)
      throw new BadRequestException('This is a passwordless account');
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (passwordMatch) {
      if (user.deletedAt)
        throw new ForbiddenException('This account is disabled');
      if (!user.phoneVerified) {
        const pinId = nanoid();
        const otp = generateOtp();
        await this.sharedService.sendOtp(otp, user.phone);
        const otpModel = this.otpRepository.create({ uuid: v4(), otp, pinId });
        this.em.persist(otpModel);
        await this.em.flush();
        return { pinId, uuid: user.uuid };
      }
      return user;
    }
    throw new UnauthorizedException('Invalid details');
  }

  async loginWithApple(identityToken: string) {
    const client = jwksClient({
      jwksUri: 'https://appleid.apple.com/auth/keys',
    });
    const getKey = (
      header: jwt.JwtHeader,
      callback: jwt.SigningKeyCallback,
    ) => {
      client.getSigningKey(header.kid, (_err, key) => {
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      });
    };
    const decoded: any = await new Promise((resolve, reject) => {
      jwt.verify(
        identityToken,
        getKey,
        { algorithms: ['RS256'] },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        },
      );
    });
    console.log('apple data', decoded);
    const email = decoded?.email;
    if (!email) throw new BadRequestException(`Could not retrieve email`);
    let user = await this.usersRepository.findOne({ email });
    if (!user) {
      const userModel = this.usersRepository.create({
        email,
        emailVerified: true,
        lastLoggedIn: new Date(),
        uuid: v4(),
        registrationType: RegistrationType.FACEBOOK,
      });
      user = userModel;
      this.em.persist(userModel);
      await this.em.flush();
    }
    const payload: IAuthContext = {
      email: user.email,
      uuid: user.uuid,
      fullName: user.fullName,
      phone: user.phone,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: 1.2e6,
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user,
    };
  }

  async loginWithFacebook(accessToken: string) {
    const response = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`,
    );
    console.log('facebook data', response.data);
    const email = response.data?.email;
    if (!email) throw new BadRequestException(`Could not retrieve email`);
    let user = await this.usersRepository.findOne({ email });
    if (!user) {
      const userModel = this.usersRepository.create({
        email,
        emailVerified: true,
        lastLoggedIn: new Date(),
        uuid: v4(),
        registrationType: RegistrationType.FACEBOOK,
      });
      user = userModel;
      this.em.persist(userModel);
      await this.em.flush();
    }
    const payload: IAuthContext = {
      email: user.email,
      uuid: user.uuid,
      fullName: user.fullName,
      phone: user.phone,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: 1.2e6,
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user,
    };
  }

  async loginWithGoogle(idToken: string) {
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    console.log('google data', response.data);
    const email = response.data?.email;
    if (!email) throw new BadRequestException(`Could not retrieve email`);
    let user = await this.usersRepository.findOne({ email });
    if (!user) {
      const userModel = this.usersRepository.create({
        email,
        emailVerified: true,
        lastLoggedIn: new Date(),
        uuid: v4(),
        registrationType: RegistrationType.GOOGLE,
      });
      user = userModel;
      this.em.persist(userModel);
      await this.em.flush();
    }
    const payload: IAuthContext = {
      email: user.email,
      uuid: user.uuid,
      fullName: user.fullName,
      phone: user.phone,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: 1.2e6,
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user,
    };
  }

  async login(user: any) {
    if (user.pinId) return user;
    const payload: IAuthContext = {
      email: user.email,
      uuid: user.uuid,
      fullName: user.fullName,
      phone: user.phone,
    };
    const userModel = await this.usersRepository.findOne({ uuid: user.uuid });
    userModel.lastLoggedIn = new Date();
    await this.em.flush();
    const clonedUser = { ...user };
    delete clonedUser.password;
    delete clonedUser.createdAt;
    delete clonedUser.updatedAt;
    return {
      accessToken: this.jwtService.sign(payload),
      expiresIn: 1.2e6,
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user,
    };
  }

  async refresh(refreshToken: string) {
    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken);
    } catch (err) {
      throw new ForbiddenException('Invalid or expired refresh token');
    }

    const isBlacklisted = await this.blacklistedTokensRepository.findOne({
      token: refreshToken,
    });
    if (isBlacklisted) {
      throw new ForbiddenException('Refresh token is blacklisted');
    }

    const blacklistedToken = this.blacklistedTokensRepository.create({
      uuid: v4(),
      token: refreshToken,
    });
    this.em.persist(blacklistedToken);
    await this.em.flush();

    delete payload.exp;
    delete payload.iat;

    const newRefreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    const newAccessToken = this.jwtService.sign(payload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 1.2e6,
    };
  }

  async verifyOtp({ otp, pinId, userUuid, otpActionType }: VerifyOtpDto) {
    const otpInDb = await this.otpRepository.findOne({ pinId });
    if (!otpInDb) throw new NotFoundException('Pin ID does not exist');
    if (otpInDb.otp !== otp) throw new UnauthorizedException('Invalid OTP');
    if (otpInDb.expiredAt !== null)
      throw new UnauthorizedException('OTP has expired');
    const diffMs = new Date().valueOf() - new Date(otpInDb.createdAt).valueOf();
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
    let otpModel = await this.otpRepository.findOne({ uuid: otpInDb.uuid });
    if (diffMins >= 10) {
      otpModel.expiredAt = new Date();
      await this.em.flush();
      throw new UnauthorizedException('OTP has expired');
    }
    switch (otpActionType) {
      case OTPActionType.VERIFY_ACCOUNT:
        const user = await this.usersRepository.findOne({ uuid: userUuid });
        user.phoneVerified = true;
        await this.em.flush();
        break;
      case OTPActionType.RESET_PASSWORD:
        const payload = { id: userUuid };
        return this.jwtService.sign(payload, {
          expiresIn: 600,
          secret: this.jwtConfig.resetPwdSecretKey,
        });
      case OTPActionType.ADMIN_RESET_PASSWORD:
        return this.jwtService.sign(
          { id: userUuid },
          {
            expiresIn: 600,
            secret: this.jwtConfig.adminResetPwdSecretKey,
          },
        );
    }
    return true;
  }

  async sendOtp({ userUuid, otpActionType }: SendOtpDto) {
    const pinId = nanoid();
    const otp = generateOtp();
    const user = await this.usersRepository.findOne({ uuid: userUuid });
    if (!user) throw new NotFoundException('User does not exist');
    await this.sharedService.sendOtp(otp, user.phone);
    const otpModel = this.otpRepository.create({ uuid: v4(), otp, pinId });
    this.em.persist(otpModel);
    await this.em.flush();
    return pinId;
  }

  async initiateResetPassword({ phone }: ResetPasswordDto) {
    const user = await this.usersRepository.findOne({ phone });
    if (!user) throw new NotFoundException('User not found');
    const pinId = nanoid();
    const otp = generateOtp();
    await this.sharedService.sendOtp(otp, user.phone);
    const otpModel = this.otpRepository.create({ uuid: v4(), otp, pinId });
    this.em.persist(otpModel);
    await this.em.flush();
    return { pinId, userUuid: user.uuid };
  }

  async changePassword(
    { oldPassword, newPassword }: ChangePasswordDto,
    { email }: IAuthContext,
  ) {
    const user = await this.usersRepository.findOne({ email });
    if (!user) throw new NotFoundException('User not found');
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch)
      throw new BadRequestException('Current password is incorrect');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await this.em.flush();
  }

  async resetPassword({ password }: NewResetPasswordDto, token: string) {
    let response: any;
    try {
      response = this.jwtService.verify(token, {
        secret: this.jwtConfig.resetPwdSecretKey,
      });
    } catch (error) {
      throw new UnauthorizedException(
        'Reset password token has expired. Kindly restart the process.',
      );
    }
    if (!response.id)
      throw new UnauthorizedException(
        'Kindly provide a valid access token to reset your password',
      );
    const { id } = response;
    const user = await this.usersRepository.findOne({ uuid: id });
    if (!user) throw new NotFoundException('User not found');
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    await this.em.flush();
  }

  async logout({ accessToken, refreshToken }: LogoutDto) {
    let accessPayload: any;
    let refreshPayload: any;

    try {
      accessPayload = this.jwtService.verify(accessToken, {
        ignoreExpiration: true,
      });
      refreshPayload = this.jwtService.verify(refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (accessPayload.uuid !== refreshPayload.uuid) {
      throw new UnauthorizedException('Token mismatch');
    }

    const user = await this.usersRepository.findOne({
      uuid: accessPayload.uuid,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.em.transactional(async (em) => {
      user.deviceToken = null;

      const blacklistedRefreshToken = this.blacklistedTokensRepository.create({
        uuid: v4(),
        token: refreshToken,
      });

      const blacklistedAccessToken = this.blacklistedTokensRepository.create({
        uuid: v4(),
        token: accessToken,
      });

      em.persist(user);
      em.persist(blacklistedRefreshToken);
      em.persist(blacklistedAccessToken);
      await em.flush();
    });
  }
}
