import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { config } from 'dotenv';

import { AppModule } from './app.module';

config({ path: '../../.env' });
config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173' });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3000), process.env.HTTP_HOST || '127.0.0.1');
}
bootstrap().catch(() => {
  console.error('Startup failed: check PostgreSQL and environment configuration');
  process.exit(1);
});
