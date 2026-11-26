import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthModule } from './health/health.module';
import { PartnerModule } from './partner/partner.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    // Rate limiting global (PDF, pág. 9): 120 req/min por IP; rotas sensíveis têm limite próprio.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    HealthModule,
    SearchModule,
    CatalogModule,
    GeocodingModule,
    PartnerModule,
    AdminModule,
  ],
  // Ordem importa: primeiro o rate limit (barra força bruta antes de tocar no banco), depois o login.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
