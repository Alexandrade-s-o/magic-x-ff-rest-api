import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.setup';

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

// Se reutiliza entre invocaciones mientras la instancia siga caliente.
let serverPromise: Promise<RequestHandler> | undefined;

async function bootstrapServer(): Promise<RequestHandler> {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance() as RequestHandler;
}

/** Handler para funciones serverless (Vercel). */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  serverPromise ??= bootstrapServer().catch((error: unknown) => {
    serverPromise = undefined; // permite reintentar en la siguiente request
    throw error;
  });
  const server = await serverPromise;
  server(req, res);
}
