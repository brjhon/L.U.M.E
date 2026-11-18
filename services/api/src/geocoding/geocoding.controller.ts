import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { GeocodeResult } from '@lume/types';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { GeoPointDto } from '../catalog/catalog.dto';
import { GeocodingService } from './geocoding.service';

export class GeocodeQueryDto {
  @ApiProperty({ example: 'Rua Domingos de Morais, 2000, São Paulo', description: 'Endereço ou CEP' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  q!: string;
}

export class GeocodeResultDto implements GeocodeResult {
  @ApiProperty() formattedAddress!: string;
  @ApiProperty({ type: GeoPointDto }) location!: GeoPointDto;
  @ApiProperty({ type: String, nullable: true }) postalCode!: string | null;
}

@ApiTags('geocoding')
@Controller({ path: 'geocode', version: '1' })
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Converte endereço digitado ou CEP em coordenadas',
    description: 'Permite buscar sem GPS (LGPD: localização precisa só com autorização).',
  })
  @ApiOkResponse({ type: [GeocodeResultDto] })
  @ApiServiceUnavailableResponse({ description: 'Provedor de mapas indisponível' })
  find(@Query() query: GeocodeQueryDto): Promise<GeocodeResultDto[]> {
    return this.geocoding.geocode(query.q);
  }
}
