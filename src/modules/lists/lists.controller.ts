import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListService } from './lists.service';

@Controller('lists')
@ApiTags('lists')
export class ListController {
  constructor(private readonly listService: ListService) {}

  @Get('banks')
  @ApiOperation({ summary: 'List banks', description: 'Fetches supported banks.' })
  @ApiOkResponse({ description: 'List of banks', schema: { type: 'array', items: { type: 'object' } } })
  fetchBanks() {
    return this.listService.fetchBanks();
  }
}
