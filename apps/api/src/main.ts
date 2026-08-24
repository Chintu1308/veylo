import * as dotenv from 'dotenv';
import * as path from 'path';

// Load local environment variables synchronously before anything else
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS — allow the Vite dev server origin (Vite may pick 5173-5179)
  app.enableCors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
      : [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
        ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('');

  const port = parseInt(process.env.API_PORT ?? '3001', 10);
  await app.listen(port);

  console.log(`\n🛡  Veylo API running on http://localhost:${port}`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ?? '(not set)'}\n`);
}

bootstrap().catch((err) => {
  console.error('Failed to start Veylo API:', err);
  process.exit(1);
});
