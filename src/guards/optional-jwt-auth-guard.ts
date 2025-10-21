import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth-guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  override canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization;
    if (!authorization) {
      return true;
    }
    return super.canActivate(context);
  }

  override handleRequest(err: any, user: any) {
    if (err) {
      throw err;
    }
    return user ?? null;
  }
}
