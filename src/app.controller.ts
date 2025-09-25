import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('root')
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Root', description: 'Basic API status endpoint' })
  @ApiOkResponse({ description: 'Welcome message', schema: { type: 'string', example: 'Welcome to Stayflix API!!!' } })
  getHello(): string {
    return 'Welcome to Stayflix API!!!';
  }
}
