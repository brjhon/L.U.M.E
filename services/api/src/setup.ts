import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { loadEnv } from './config/env';
import { HttpExceptionFilter } from './http-exception.filter';
import { version } from './version';

/** Configuração compartilhada entre main.ts, testes e geração do OpenAPI. */
export function configureApp(app: INestApplication): void {
  const env = loadEnv();
  const express = app.getHttpAdapter().getInstance() as Express;
  // IP real do cliente vem do X-Forwarded-For só quando há proxy confiável na frente.
  express.set('trust proxy', env.trustProxy);
  express.disable('x-powered-by');

  app.use(
    helmet({
      // A API só devolve JSON; a CSP estrita quebraria o Swagger UI, que só existe fora de produção.
      contentSecurityPolicy: env.isProduction ? undefined : false,
      // HSTS fica a cargo do proxy (Caddy), que sabe se a conexão é HTTPS.
      strictTransportSecurity: false,
    }),
  );
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: env.corsOrigins });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('API L.U.M.E.')
    .setDescription('Localizador Unificado de Mercados e Especialistas')
    .setVersion(version)
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}
