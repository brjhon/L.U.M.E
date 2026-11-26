import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MODERATION_DECISIONS,
  MODERATION_STATUS,
  type ModerationDecision,
  type ModerationQueueItem,
  type ModerationStatus,
} from '@lume/types';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class ModerationQueueQueryDto {
  @ApiPropertyOptional({ enum: ['PROVIDER', 'LISTING'], description: 'Sem valor: os dois' })
  @IsOptional()
  @IsIn(['PROVIDER', 'LISTING'])
  kind?: 'PROVIDER' | 'LISTING';

  @ApiPropertyOptional({ enum: MODERATION_STATUS, default: 'PENDING' })
  @IsOptional()
  @IsIn(MODERATION_STATUS)
  status: ModerationStatus = 'PENDING';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class ModerationDecisionDto {
  @ApiProperty({ enum: MODERATION_DECISIONS })
  @IsIn(MODERATION_DECISIONS)
  decision!: ModerationDecision;

  @ApiPropertyOptional({ description: 'Obrigatório ao rejeitar ou suspender; o parceiro vê este texto' })
  @ValidateIf((o: ModerationDecisionDto) => o.decision !== 'APPROVED' || o.note !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5, { message: 'Explique o motivo para o parceiro (mín. 5 caracteres)' })
  @MaxLength(500)
  note?: string;
}

export class VerifyCoverageDto {
  @ApiProperty({ description: 'true marca como verificada (CONFIRMED na busca); false desfaz' })
  @IsBoolean()
  verified!: boolean;
}

class QueueProviderDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: MODERATION_STATUS }) status!: ModerationStatus;
}

class QueueOwnerDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
}

export class ModerationQueueItemDto implements ModerationQueueItem {
  @ApiProperty({ enum: ['PROVIDER', 'LISTING'] }) kind!: 'PROVIDER' | 'LISTING';
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: MODERATION_STATUS }) status!: ModerationStatus;
  @ApiProperty({ type: QueueProviderDto }) provider!: QueueProviderDto;
  @ApiProperty({ type: QueueOwnerDto, nullable: true }) owner!: QueueOwnerDto | null;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class ModerationQueueDto {
  @ApiProperty({ type: [ModerationQueueItemDto] }) items!: ModerationQueueItemDto[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasMore!: boolean;
}
