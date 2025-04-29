import { registerAs } from '@nestjs/config';
import { JwtAuthConfig } from './types/jwt-auth.config';
import { SmtpConfig } from './types/smtp.config';
import { TermiiConfig } from './types/termii.config';
import { PaystackConfig } from './types/paystack.config';

export const JwtAuthConfiguration = registerAs(
  'jwtAuthConfig',
  (): JwtAuthConfig => ({
    secretKey: process.env.JWT_SECRET_KEY || 'secret',
    adminSecretKey: process.env.ADMIN_JWT_SECRET_KEY || 'admin-secret',
    resetPwdSecretKey:
      process.env.RESET_PWD_JWT_SECRET_KEY || 'reset-pwd-secret',
    adminResetPwdSecretKey:
      process.env.ADMIN_RESET_PWD_JWT_SECRET_KEY || 'admin-reset-pwd-secret',
  }),
);

export const SmtpConfiguration = registerAs(
  'smtpConfig',
  (): SmtpConfig => ({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
  }),
);

export const TermiiConfiguration = registerAs(
  'termiiConfig',
  (): TermiiConfig => ({
    baseUrl: process.env.TERMII_BASE_URL,
    apiKey: process.env.TERMII_API_KEY,
  }),
);

export const PaystackConfiguration = registerAs(
  'paystackConfig',
  (): PaystackConfig => ({
    baseUrl: process.env.PAYSTACK_BASE_URL,
    secretKey: process.env.PAYSTACK_SECRET_KEY,
  }),
);
