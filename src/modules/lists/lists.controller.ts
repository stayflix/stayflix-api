import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListService } from './lists.service';

@Controller('lists')
@ApiTags('lists')
export class ListController {
  constructor(private readonly listService: ListService) {}

  @Get('banks')
  fetchBanks() {
    return this.listService.fetchBanks();
  }
}
