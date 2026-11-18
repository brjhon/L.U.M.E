import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CONTACT_CHANNELS,
  ELIGIBILITY,
  PROVIDER_KINDS,
  SERVICE_MODES,
  type Category,
  type ContactChannel,
  type Eligibility,
  type ListingDetail,
  type ProviderKind,
  type ServiceMode,
} from '@lume/types';
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsUUID } from 'class-validator';
import { CategorySummaryDto } from '../search/search.dto';

export class CategoryDto implements Category {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true, description: 'Nome do ícone Material' }) icon!: string | null;
  @ApiProperty({ description: 'Categoria com controles reforçados (ex.: cuidadores)' }) sensitive!: boolean;
  @ApiProperty({ type: () => [CategoryDto] }) children!: CategoryDto[];
}

export class ListingDetailQueryDto {
  @ApiPropertyOptional({ description: 'Com lat/lng, a resposta traz elegibilidade e distância' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;
}

export class GeoPointDto {
  @ApiProperty() lat!: number;
  @ApiProperty() lng!: number;
}

export class ProviderLocationDto {
  @ApiProperty() address!: string;
  @ApiProperty({ type: GeoPointDto }) location!: GeoPointDto;
}

export class ListingProviderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PROVIDER_KINDS }) kind!: ProviderKind;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Número no formato E.164, sem "+"' })
  whatsapp!: string | null;
  @ApiProperty({ type: [ProviderLocationDto] }) locations!: ProviderLocationDto[];
}

export class ListingDetailDto implements ListingDetail {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: SERVICE_MODES }) mode!: ServiceMode;
  @ApiProperty({ type: CategorySummaryDto }) category!: CategorySummaryDto;
  @ApiProperty({ type: ListingProviderDto }) provider!: ListingProviderDto;
  @ApiProperty({ enum: ELIGIBILITY, nullable: true }) eligibility!: Eligibility | null;
  @ApiProperty({ type: Number, nullable: true }) distanceM!: number | null;
}

export class ContactEventDto {
  @ApiProperty({ enum: CONTACT_CHANNELS })
  @IsIn(CONTACT_CHANNELS)
  channel!: ContactChannel;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;
}
