import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ChangePasswordDto,
  LoginDTO,
  LoginWithAppleDto,
  LoginWithFacebookDto,
  LoginWithGoogleDto,
  LogoutDto,
  NewResetPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SendOtpDto,
  SignupStepOneDto,
  SignupStepTwoDto,
  VerifyOtpDto,
} from './auth.dto';
import { LocalAuthGuard } from 'src/guards/local-auth-guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { extractTokenFromReq } from 'src/utils';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup/step-1')
  @ApiOperation({ summary: 'Start signup', description: 'Creates a user and returns their UUID to continue signup.' })
  @ApiCreatedResponse({ description: 'User UUID created', schema: { type: 'string', example: '7f5b9f3e-1234-4b27-9d0f-a1b2c3d4e5f6' } })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  signupStepOne(@Body() body: SignupStepOneDto) {
    return this.authService.signupStepOne(body);
  }

  @Post('signup/step-2')
  @ApiOperation({ summary: 'Complete signup', description: 'Completes signup and returns a pinId for OTP verification and the user UUID.' })
  @ApiCreatedResponse({
    description: 'Signup step-two initiated',
    schema: {
      type: 'object',
      properties: {
        pinId: { type: 'string', example: 'cJx7Q1SkLw' },
        uuid: { type: 'string', example: '7f5b9f3e-1234-4b27-9d0f-a1b2c3d4e5f6' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation or conflict error' })
  @ApiNotFoundResponse({ description: 'User not found' })
  signupStepTwo(@Body() body: SignupStepTwoDto) {
    return this.authService.signupStepTwo(body);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login', description: 'Authenticates a user by email/phone + password and returns access/refresh tokens.' })
  @ApiCreatedResponse({
    description: 'Authenticated',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        expiresIn: { type: 'number', example: 1200000 },
        refreshToken: { type: 'string' },
        user: { type: 'object' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or unverified phone' })
  @ApiNotFoundResponse({ description: 'User not found' })
  login(@Body() _body: LoginDTO, @Req() req: any) {
    return this.authService.login(req.user);
  }

  @Post('google')
  @ApiOperation({ summary: 'Login with Google', description: 'Authenticates a user using a Google ID token.' })
  @ApiCreatedResponse({ description: 'Authenticated via Google', schema: { type: 'object' } })
  @ApiBadRequestResponse({ description: 'Could not retrieve email' })
  async loginWithGoogle(@Body() { idToken }: LoginWithGoogleDto) {
    return this.authService.loginWithGoogle(idToken);
  }

  @Post('facebook')
  @ApiOperation({ summary: 'Login with Facebook', description: 'Authenticates a user using a Facebook access token.' })
  @ApiCreatedResponse({ description: 'Authenticated via Facebook', schema: { type: 'object' } })
  @ApiBadRequestResponse({ description: 'Could not retrieve email' })
  async loginWithFacebook(@Body() { accessToken }: LoginWithFacebookDto) {
    return this.authService.loginWithFacebook(accessToken);
  }

  @Post('apple')
  @ApiOperation({ summary: 'Login with Apple', description: 'Authenticates a user using an Apple identity token.' })
  @ApiCreatedResponse({ description: 'Authenticated via Apple', schema: { type: 'object' } })
  @ApiBadRequestResponse({ description: 'Could not retrieve email' })
  async loginWithApple(@Body() { identityToken }: LoginWithAppleDto) {
    return this.authService.loginWithApple(identityToken);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh tokens', description: 'Exchanges a valid refresh token for a new access/refresh token pair.' })
  @ApiOkResponse({
    description: 'Tokens refreshed',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number', example: 1200000 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  refresh(@Body() { refreshToken }: RefreshTokenDto) {
    return this.authService.refresh(refreshToken);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP', description: 'Verifies an OTP for account actions. Returns true for verify-account or a short-lived token for reset flows.' })
  @ApiOkResponse({
    description: 'Verification result',
    schema: {
      oneOf: [
        { type: 'boolean', example: true },
        { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired OTP' })
  @ApiNotFoundResponse({ description: 'Pin ID does not exist' })
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body);
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP', description: 'Sends a fresh OTP and returns a new pinId.' })
  @ApiCreatedResponse({ description: 'OTP sent', schema: { type: 'string', example: 'cJx7Q1SkLw' } })
  @ApiNotFoundResponse({ description: 'User does not exist' })
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body);
  }

  @Post('initiate-reset-password')
  @ApiOperation({ summary: 'Initiate password reset', description: 'Initiates reset by phone, returning a pinId and the user UUID.' })
  @ApiCreatedResponse({
    description: 'Reset initiated',
    schema: {
      type: 'object',
      properties: {
        pinId: { type: 'string', example: 'cJx7Q1SkLw' },
        userUuid: { type: 'string', example: '7f5b9f3e-1234-4b27-9d0f-a1b2c3d4e5f6' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  initiateResetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.initiateResetPassword(body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password', description: 'Changes the password for the authenticated user.' })
  @ApiOkResponse({ description: 'Password changed' })
  @ApiBadRequestResponse({ description: 'Current password is incorrect' })
  @ApiNotFoundResponse({ description: 'User not found' })
  changePassword(@Body() body: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(body, req.user);
  }

  @Post('reset-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset password', description: 'Resets password using a short-lived token sent after OTP verification.' })
  @ApiOkResponse({ description: 'Password reset successful' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  resetPassword(@Body() body: NewResetPasswordDto, @Req() req: Request) {
    const token = extractTokenFromReq(
      req,
      'Kindly provide a valid access token to reset your password',
    );
    return this.authService.resetPassword(body, token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout', description: 'Logs out the authenticated user and blacklists the tokens.' })
  @ApiOkResponse({ description: 'Logged out successfully' })
  logout(@Body() body: LogoutDto) {
    return this.authService.logout(body);
  }
}
