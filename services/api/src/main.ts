import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { buildOpenApi, configureApp } from './setup';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  if (env.nodeEnv !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApi(app));
  }
  await app.listen(env.port);
  Logger.log(`API L.U.M.E. em http://localhost:${env.port}/v1/health`, 'Bootstrap');
}

bootstrap();
