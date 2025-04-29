import { EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  SmtpConfiguration,
  TermiiConfiguration,
} from 'src/config/configuration';
import { NotificationTemplates } from 'src/entities/notification-templates.entity';
import phone from 'phone';
import { IEmailDto } from 'src/types';
import mailer from 'nodemailer-promise';
import { replacer } from 'src/utils';
import axios from 'axios';

@Injectable()
export class SharedService {
  private readonly logger: Logger = new Logger(SharedService.name);

  constructor(
    @InjectRepository(NotificationTemplates)
    private readonly notificationTemplatesRepository: EntityRepository<NotificationTemplates>,
    @Inject(SmtpConfiguration.KEY)
    private readonly smtpConfig: ConfigType<typeof SmtpConfiguration>,
    @Inject(TermiiConfiguration.KEY)
    private readonly termiiConfig: ConfigType<typeof TermiiConfiguration>,
  ) {}

  validatePhoneNumber(phoneNo: string) {
    const { isValid, phoneNumber } = phone(phoneNo, { country: 'NG' });
    if (!isValid)
      throw new BadRequestException(
        'Phone number must be a valid nigeria phone number',
      );
    return phoneNumber;
  }

  async sendEmail(email: IEmailDto) {
    const sendMail = mailer.config({
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: true,
      from: 'Stayflix <no-reply@stayflix.com>',
      auth: {
        user: this.smtpConfig.username,
        pass: this.smtpConfig.password,
      },
    });
    const notificationTemplate =
      await this.notificationTemplatesRepository.findOne({
        code: email.templateCode,
      });
    if (!notificationTemplate)
      throw new NotFoundException(
        `Notification template: ${email.templateCode} does not exist`,
      );
    email.html = email.data
      ? replacer(0, Object.entries(email.data), notificationTemplate.body)
      : notificationTemplate.body;
    delete email.templateCode;
    if (!email.bcc) email.bcc = 'admin@stayflix.com';
    if (!email.from) email.from = 'Stayflix <no-reply@stayflix.com>';
    sendMail(email);
  }

  async sendOtp(otp: string, phone: string, email?: IEmailDto) {
    let smsOtpResponse: any;
    try {
      smsOtpResponse = await axios.post(
        `${this.termiiConfig.baseUrl}/api/sms/send`,
        {
          to: phone,
          from: 'N-Alert',
          sms: `Your Stayflix verification code is ${otp}. Valid for 10 mins, one-time use only.`,
          type: 'plain',
          channel: 'dnd',
          api_key: this.termiiConfig.apiKey,
        },
      );
    } catch (error) {
      this.logger.error(
        `Error occurred while Sending SMS OTP to: ${phone}. Error: ${error}`,
      );
      throw error;
    }
    if (smsOtpResponse.data.code !== 'ok')
      throw new InternalServerErrorException(smsOtpResponse.data.message);
    return otp;
  }
}
