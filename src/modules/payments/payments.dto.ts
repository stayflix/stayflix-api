import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ResolveAccountDto {
  @IsString()
  accountNumber: string;

  @IsString()
  bankCode: string;
}

export class SaveBankAccountDto extends ResolveAccountDto {
  @IsString()
  bankName: string;

  @IsString()
  accountName: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ default: true })
  makeDefault?: boolean = true;
}

export class InitiatePayoutDto {
  @IsUUID()
  userUuid: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Apartment UUID associated with payout' })
  apartmentUuid?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;
}
