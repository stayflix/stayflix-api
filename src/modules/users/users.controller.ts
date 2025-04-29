import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { DeactivateAccountDto, UpdateUserInfo, VerifyBankAccountDto } from './users.dto';
import { Request } from 'express';

@Controller('users')
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Post('update-info')
  async updateUserInfo(@Body() body: UpdateUserInfo, @Req() request: Request) {
    return this.userService.updateUserInfo(body, request.user as any);
  }

  @Post('deactivate')
  async deactivateAccount(
    @Body() body: DeactivateAccountDto,
    @Req() request: Request,
  ) {
    return this.userService.deactivateAccount(body, request.user as any);
  }

  @Post('verify-bank-account')
  verifyBankAccount(
    @Body() body: VerifyBankAccountDto,
    @Req() request: Request,
  ) {
    return this.userService.verifyBankAccount(body, request.user as any);
  }
}
