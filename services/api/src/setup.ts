import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { loadEnv } from './config/env';
import { HttpExceptionFilter } from './http-exception.filter';
import { version } from './version';

/** Configuração compartilhada entre main.ts, testes e geração do OpenAPI. */
export function configureApp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: loadEnv().corsOrigins });
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
