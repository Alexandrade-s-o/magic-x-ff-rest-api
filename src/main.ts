import 'dotenv/config';
import { createApp } from './app.setup';

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3002);
}

void bootstrap().catch((error: unknown) => {
  console.error('Application failed to start:', error);
  process.exitCode = 1;
});
