import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  @ApiProperty({
    description: 'Message content',
    example: 'Hi there, I have a question about this listing.',
  })
  message: string;
}
