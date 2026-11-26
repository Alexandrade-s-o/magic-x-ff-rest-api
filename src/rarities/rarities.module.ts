import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RaritiesController } from './rarities.controller.js';
import { RaritiesService } from './rarities.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [RaritiesController],
  providers: [RaritiesService],
})
export class RaritiesModule {}
