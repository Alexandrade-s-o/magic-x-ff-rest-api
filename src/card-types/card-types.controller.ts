import { Controller, Get } from '@nestjs/common';
import { CardTypesService } from './card-types.service.js';

@Controller('card-types')
export class CardTypesController {
  constructor(private readonly cardTypesService: CardTypesService) {}

  @Get()
  findAll() {
    return this.cardTypesService.findAll();
  }
}
