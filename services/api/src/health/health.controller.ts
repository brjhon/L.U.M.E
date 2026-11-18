import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@lume/types';
import type { Response } from 'express';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { version } from '../version';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  @ApiOkResponse({ description: 'API e banco operacionais' })
  @ApiServiceUnavailableResponse({ description: 'Banco indisponível' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';
    let postgis: string | null = null;
    try {
      const { rows } = await this.pool.query<{ v: string }>('SELECT postgis_lib_version() AS v');
      database = 'up';
      postgis = rows[0]?.v ?? null;
    } catch {
      // Não expõe detalhes do erro na resposta pública.
    }
    const status = database === 'up' ? 'ok' : 'degraded';
    if (status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status,
      version,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, postgis },
    };
  }
}
