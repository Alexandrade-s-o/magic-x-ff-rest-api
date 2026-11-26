import { Module } from '@nestjs/common';
import Groq from 'groq-sdk';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdvisorController } from './advisor.controller.js';
import { AdvisorService } from './advisor.service.js';
import { AdvisorTools } from './advisor.tools.js';
import { GROQ_CLIENT, type AdvisorLlmClient } from './advisor.constants.js';

@Module({
  imports: [PrismaModule],
  controllers: [AdvisorController],
  providers: [
    AdvisorTools,
    AdvisorService,
    {
      provide: GROQ_CLIENT,
      // Sin clave, el asesor responde 503 y el resto de la API sigue funcionando.
      useFactory: (): AdvisorLlmClient | null =>
        process.env.GROQ_API_KEY
          ? new Groq({
              apiKey: process.env.GROQ_API_KEY,
              maxRetries: 1,
              timeout: 45_000,
            })
          : null,
    },
  ],
})
export class AdvisorModule {}
