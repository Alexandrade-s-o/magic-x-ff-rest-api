import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CardTypesController } from './card-types.controller.js';
import { CardTypesService } from './card-types.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CardTypesController],
  providers: [CardTypesService],
})
export class CardTypesModule {}
