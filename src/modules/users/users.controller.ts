import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Update profile', description: 'Updates the authenticated user profile information.' })
  @ApiOkResponse({ description: 'User profile updated', schema: { type: 'object' } })
  @ApiBadRequestResponse({ description: 'Validation error' })
  async updateUserInfo(@Body() body: UpdateUserInfo, @Req() request: Request) {
    return this.userService.updateUserInfo(body, request.user as any);
  }

  @Post('deactivate')
  @ApiOperation({ summary: 'Deactivate account', description: 'Disables the authenticated user account.' })
  @ApiOkResponse({ description: 'Account deactivated' })
  async deactivateAccount(
    @Body() body: DeactivateAccountDto,
    @Req() request: Request,
  ) {
    return this.userService.deactivateAccount(body, request.user as any);
  }

  @Post('verify-bank-account')
  @ApiOperation({ summary: 'Verify bank account', description: 'Verifies the bank account of the authenticated user.' })
  @ApiOkResponse({ description: 'Bank account verified', schema: { type: 'object' } })
  @ApiNotFoundResponse({ description: 'User not found' })
  verifyBankAccount(
    @Body() body: VerifyBankAccountDto,
    @Req() request: Request,
  ) {
    return this.userService.verifyBankAccount(body, request.user as any);
  }
}
