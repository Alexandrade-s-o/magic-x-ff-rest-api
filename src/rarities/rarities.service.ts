import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RaritiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.rarity.findMany({ orderBy: { name: 'asc' } });
  }
}
