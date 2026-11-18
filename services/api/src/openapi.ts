/** Gera docs/openapi.json sem precisar de banco (usado pelo Flutter e pela CI). */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { buildOpenApi, configureApp } from './setup';

async function run() {
  process.env.DATABASE_URL ??= 'postgres://unused@localhost/unused';
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  const out = join(__dirname, '..', '..', '..', 'docs', 'openapi.json');
  writeFileSync(out, JSON.stringify(buildOpenApi(app), null, 2) + '\n');
  await app.close();
  console.log(`OpenAPI salvo em ${out}`);
}

run();
