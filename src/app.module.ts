import { Module } from '@nestjs/common';
import { CardsModule } from './cards/cards.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CardTypesModule } from './card-types/card-types.module.js';
import { RaritiesModule } from './rarities/rarities.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CollectionsModule } from './collections/collections.module.js';
import { AdvisorModule } from './advisor/advisor.module.js';

@Module({
  imports: [
    PrismaModule,
    CardsModule,
    RaritiesModule,
    CardTypesModule,
    UsersModule,
    AuthModule,
    CollectionsModule,
    AdvisorModule,
  ],
})
export class AppModule {}
