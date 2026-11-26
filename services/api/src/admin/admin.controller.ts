import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { PartnerProviderDto } from '../partner/partner.dto';
import { PartnerService } from '../partner/partner.service';
import { ModerationDecisionDto, ModerationQueueDto, ModerationQueueQueryDto, VerifyCoverageDto } from './admin.dto';
import { AdminService } from './admin.service';

const Uuid = () => new ParseUUIDPipe();

/** Moderação: só PLATFORM_ADMIN. Toda decisão vai para audit_logs. */
@ApiTags('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse()
@ApiForbiddenResponse({ description: 'Só administradores da plataforma' })
@Roles('PLATFORM_ADMIN')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly partner: PartnerService,
  ) {}

  @Get('moderation')
  @ApiOperation({ summary: 'Fila de moderação (padrão: pendentes, mais antigos primeiro)' })
  @ApiOkResponse({ type: ModerationQueueDto })
  queue(@Query() q: ModerationQueueQueryDto): Promise<ModerationQueueDto> {
    return this.admin.queue(q);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Fornecedor completo para análise (endereços, ofertas, cobertura)' })
  @ApiOkResponse({ type: PartnerProviderDto })
  @ApiNotFoundResponse()
  provider(@Param('id', Uuid()) id: string): Promise<PartnerProviderDto> {
    return this.partner.getProviderForAdmin(id);
  }

  @Post('providers/:id/decision')
  @HttpCode(204)
  @ApiOperation({ summary: 'Aprova, rejeita ou suspende um fornecedor' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async decideProvider(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: ModerationDecisionDto,
  ): Promise<void> {
    await this.admin.decideProvider(user.id, id, dto.decision, dto.note);
  }

  @Post('listings/:id/decision')
  @HttpCode(204)
  @ApiOperation({ summary: 'Aprova, rejeita ou suspende uma oferta' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async decideListing(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: ModerationDecisionDto,
  ): Promise<void> {
    await this.admin.decideListing(user.id, id, dto.decision, dto.note);
  }

  @Post('coverage/:id/verify')
  @HttpCode(204)
  @ApiOperation({ summary: 'Marca (ou desmarca) uma área de cobertura como verificada' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async verifyCoverage(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: VerifyCoverageDto,
  ): Promise<void> {
    await this.admin.verifyCoverage(user.id, id, dto.verified);
  }
}
