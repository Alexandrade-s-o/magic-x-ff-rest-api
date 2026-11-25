import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

/**
 * Crea y configura la aplicación Nest. La usan tanto `main.ts` (servidor
 * tradicional con `listen`) como `serverless.ts` (función de Vercel).
 */
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Detrás de un proxy (Vercel, Render...) la IP real viene en X-Forwarded-For.
  // Necesario para que el rate limit cuente por IP de cliente y no por proxy.
  if (process.env.VERCEL || process.env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  // El frontend autentica las solicitudes con Bearer tokens, no con cookies.
  // CORS_ORIGIN acepta una lista separada por comas; por defecto '*'.
  const corsOrigin = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // Cabeceras de seguridad por defecto (HSTS, X-Content-Type-Options, etc.).
  app.use(helmet());

  // Límite global de velocidad: evita abuso de fuerza bruta y flood de requests.
  // Nota: en serverless el contador vive en memoria de cada instancia.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 300, // máximo 300 requests por IP por ventana
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests',
        message: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true, // Filtra propiedades que no esten en el DTO
      forbidNonWhitelisted: true, // Lanza error si hay propiedades adicionales
    }),
  );

  return app;
}
