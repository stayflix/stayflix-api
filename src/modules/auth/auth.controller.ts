import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

@Controller('auth')
@ApiTags('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup/step-1')
  signupStepOne(@Body() body: SignupStepOneDto) {
    return this.authService.signupStepOne(body);
  }

  @Post('signup/step-2')
  signupStepTwo(@Body() body: SignupStepTwoDto) {
    return this.authService.signupStepTwo(body);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  login(@Body() _body: LoginDTO, @Req() req: any) {
    return this.authService.login(req.user);
  }

  @Post('google')
  async loginWithGoogle(@Body() { idToken }: LoginWithGoogleDto) {
    return this.authService.loginWithGoogle(idToken);
  }

  @Post('facebook')
  async loginWithFacebook(@Body() { accessToken }: LoginWithFacebookDto) {
    return this.authService.loginWithFacebook(accessToken);
  }

  @Post('apple')
  async loginWithApple(@Body() { identityToken }: LoginWithAppleDto) {
    return this.authService.loginWithApple(identityToken);
  }

  @Post('refresh')
  refresh(@Body() { refreshToken }: RefreshTokenDto) {
    return this.authService.refresh(refreshToken);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body);
  }

  @Post('send-otp')
  sendOtp(@Body() body: SendOtpDto) {
    return this.authService.sendOtp(body);
  }

  @Post('initiate-reset-password')
  initiateResetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.initiateResetPassword(body);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Body() body: ChangePasswordDto, @Req() req: any) {
    return this.authService.changePassword(body, req.user);
  }

  @Post('reset-password')
  resetPassword(@Body() body: NewResetPasswordDto, @Req() req: Request) {
    const token = extractTokenFromReq(
      req,
      'Kindly provide a valid access token to reset your password',
    );
    return this.authService.resetPassword(body, token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Body() body: LogoutDto) {
    return this.authService.logout(body);
  }
}
