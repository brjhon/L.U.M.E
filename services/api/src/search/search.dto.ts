import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ELIGIBILITY,
  PROVIDER_KINDS,
  SERVICE_MODES,
  type Eligibility,
  type ProviderKind,
  type SearchResponse,
  type SearchResultItem,
  type ServiceMode,
} from '@lume/types';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: -23.5869, description: 'Latitude do endereço buscado' })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -46.6395, description: 'Longitude do endereço buscado' })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiPropertyOptional({ example: 'eletricista', description: 'Texto livre (sem diferenciar acentos)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 'servicos-gerais', description: 'Slug da categoria (inclui subcategorias)' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,60}$/)
  category?: string;

  @ApiPropertyOptional({ enum: SERVICE_MODES })
  @IsOptional()
  @IsIn(SERVICE_MODES)
  mode?: ServiceMode;

  @ApiPropertyOptional({ format: 'uuid', description: 'Comunidade do usuário, para cobertura do tipo COMMUNITY' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({
    default: 15000,
    minimum: 500,
    maximum: 50000,
    description: 'Distância máxima para comércios presenciais e fornecedores sem cobertura declarada',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(50000)
  maxDistanceM: number = 15000;

  @ApiPropertyOptional({ default: false, description: 'Incluir, separados, os que declaram não atender o endereço' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeNotServed: boolean = false;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;
}

export class CategorySummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
}

export class SearchProviderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PROVIDER_KINDS }) kind!: ProviderKind;
  @ApiProperty() displayName!: string;
}

export class SearchResultItemDto implements SearchResultItem {
  @ApiProperty({ format: 'uuid' }) listingId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: SERVICE_MODES }) mode!: ServiceMode;
  @ApiProperty({
    enum: ELIGIBILITY,
    nullable: true,
    description: 'Só para DELIVERY e AT_HOME. "Atende seu endereço" apenas quando CONFIRMED.',
  })
  eligibility!: Eligibility | null;
  @ApiProperty({ type: Number, nullable: true }) distanceM!: number | null;
  @ApiProperty({ type: CategorySummaryDto }) category!: CategorySummaryDto;
  @ApiProperty({ type: SearchProviderDto }) provider!: SearchProviderDto;
}

export class SearchResponseDto implements SearchResponse {
  @ApiProperty({ type: [SearchResultItemDto] }) items!: SearchResultItemDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasMore!: boolean;
}
