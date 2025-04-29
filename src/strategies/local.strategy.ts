import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from 'src/modules/auth/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'emailOrPhone', passReqToCallback: false });
  }

  async validate(emailOrPhone: string, password: string) {
    const user = await this.authService.validateUser(emailOrPhone, password);
    return user;
  }
}
