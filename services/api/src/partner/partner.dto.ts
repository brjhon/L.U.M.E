import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  COVERAGE_TYPES,
  MODERATION_STATUS,
  PROVIDER_KINDS,
  SERVICE_MODES,
  type CoverageArea,
  type CoverageType,
  type GeoJsonArea,
  type ModerationStatus,
  type PartnerListing,
  type PartnerProvider,
  type ProviderKind,
  type ServiceMode,
} from '@lume/types';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { GeoPointDto } from '../catalog/catalog.dto';
import { CategorySummaryDto } from '../search/search.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const PHONE = /^\d{12,13}$/;
const PHONE_MESSAGE = 'Só dígitos, com 55 e DDD (ex.: 5511999990000)';

/** Limites contra abuso e erro de digitação. */
export const LIMITS = {
  providersPerUser: 5,
  locationsPerProvider: 10,
  listingsPerProvider: 50,
  coveragePerListing: 20,
  maxRadiusM: 50_000,
  maxPolygonPoints: 1_000,
  maxPolygonKm2: 2_000,
} as const;

// ---------- Entrada ----------

export class CreateProviderDto {
  @ApiProperty({ enum: PROVIDER_KINDS })
  @IsIn(PROVIDER_KINDS)
  kind!: ProviderKind;

  @ApiProperty({ example: 'Elétrica Silva' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: '5511999990000' })
  @IsOptional()
  @Matches(PHONE, { message: `phone: ${PHONE_MESSAGE}` })
  phone?: string;

  @ApiPropertyOptional({ example: '5511999990000' })
  @IsOptional()
  @Matches(PHONE, { message: `whatsapp: ${PHONE_MESSAGE}` })
  whatsapp?: string;
}

export class UpdateProviderDto {
  @ApiPropertyOptional({ enum: PROVIDER_KINDS })
  @IsOptional()
  @IsIn(PROVIDER_KINDS)
  kind?: ProviderKind;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Matches(PHONE, { message: `phone: ${PHONE_MESSAGE}` })
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Matches(PHONE, { message: `whatsapp: ${PHONE_MESSAGE}` })
  whatsapp?: string | null;
}

export class CreateLocationDto {
  @ApiProperty({ example: 'Rua Domingos de Morais, 2000 - Vila Mariana, São Paulo' })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  address!: string;

  @ApiProperty() @Type(() => Number) @IsLatitude() lat!: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() lng!: number;
}

export class CreateListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Instalação de chuveiro e tomadas' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: SERVICE_MODES })
  @IsIn(SERVICE_MODES)
  mode!: ServiceMode;
}

export class UpdateListingDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: SERVICE_MODES })
  @IsOptional()
  @IsIn(SERVICE_MODES)
  mode?: ServiceMode;
}

/**
 * Área de cobertura. Conforme `type`:
 * RADIUS (centerLat, centerLng, radiusM) · POLYGON (polygon GeoJSON) · COMMUNITY (communityId).
 */
export class CreateCoverageDto {
  @ApiProperty({ enum: COVERAGE_TYPES })
  @IsIn(COVERAGE_TYPES)
  type!: CoverageType;

  @ApiPropertyOptional({ description: 'RADIUS' })
  @ValidateIf((o: CreateCoverageDto) => o.type === 'RADIUS')
  @Type(() => Number)
  @IsLatitude()
  centerLat?: number;

  @ApiPropertyOptional({ description: 'RADIUS' })
  @ValidateIf((o: CreateCoverageDto) => o.type === 'RADIUS')
  @Type(() => Number)
  @IsLongitude()
  centerLng?: number;

  @ApiPropertyOptional({ description: `RADIUS, em metros (até ${LIMITS.maxRadiusM})` })
  @ValidateIf((o: CreateCoverageDto) => o.type === 'RADIUS')
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(LIMITS.maxRadiusM)
  radiusM?: number;

  @ApiPropertyOptional({
    description: 'POLYGON: geometria GeoJSON Polygon ou MultiPolygon, coordenadas [lng, lat]',
    example: { type: 'Polygon', coordinates: [[[-46.64, -23.59], [-46.63, -23.59], [-46.63, -23.58], [-46.64, -23.59]]] },
  })
  @ValidateIf((o: CreateCoverageDto) => o.type === 'POLYGON')
  @IsObject()
  polygon?: GeoJsonArea;

  @ApiPropertyOptional({ format: 'uuid', description: 'COMMUNITY' })
  @ValidateIf((o: CreateCoverageDto) => o.type === 'COMMUNITY')
  @IsUUID()
  communityId?: string;
}

// ---------- Saída ----------

export class CoverageAreaDto implements CoverageArea {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: COVERAGE_TYPES }) type!: CoverageType;
  @ApiProperty({ type: Number, nullable: true }) radiusM!: number | null;
  @ApiProperty({ type: GeoPointDto, nullable: true }) center!: GeoPointDto | null;
  @ApiProperty({ type: Object, nullable: true, description: 'GeoJSON MultiPolygon' }) polygon!: GeoJsonArea | null;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' }) communityId!: string | null;
  @ApiProperty() verified!: boolean;
}

export class PartnerListingDto implements PartnerListing {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) providerId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: SERVICE_MODES }) mode!: ServiceMode;
  @ApiProperty({ enum: MODERATION_STATUS }) status!: ModerationStatus;
  @ApiProperty({ type: String, nullable: true }) moderationNote!: string | null;
  @ApiProperty({ type: CategorySummaryDto }) category!: CategorySummaryDto;
  @ApiProperty({ type: [CoverageAreaDto] }) coverage!: CoverageAreaDto[];
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PartnerLocationDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() address!: string;
  @ApiProperty({ type: GeoPointDto }) location!: GeoPointDto;
}

export class PartnerProviderDto implements PartnerProvider {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PROVIDER_KINDS }) kind!: ProviderKind;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true }) whatsapp!: string | null;
  @ApiProperty({ enum: MODERATION_STATUS }) status!: ModerationStatus;
  @ApiProperty({ type: String, nullable: true }) moderationNote!: string | null;
  @ApiProperty({ type: [PartnerLocationDto] }) locations!: PartnerLocationDto[];
  @ApiProperty({ type: [PartnerListingDto] }) listings!: PartnerListingDto[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
