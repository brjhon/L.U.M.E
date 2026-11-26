import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthUser } from '../auth/decorators';
import {
  CreateCoverageDto,
  CreateListingDto,
  CreateLocationDto,
  CreateProviderDto,
  PartnerListingDto,
  PartnerProviderDto,
  UpdateListingDto,
  UpdateProviderDto,
} from './partner.dto';
import { PartnerService } from './partner.service';

const Uuid = () => new ParseUUIDPipe();

/**
 * Área do parceiro: cada um só enxerga e altera o que é seu (o resto dá 404).
 * Qualquer conta logada pode cadastrar um fornecedor; tudo nasce PENDING e só aparece
 * no app depois de aprovado pela moderação. Editar conteúdo aprovado volta para a fila.
 */
@ApiTags('partner')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem login' })
@ApiForbiddenResponse({ description: 'Cadastro suspenso pela moderação' })
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller({ path: 'partner', version: '1' })
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('providers')
  @ApiOperation({ summary: 'Meus fornecedores, com endereços, ofertas e cobertura' })
  @ApiOkResponse({ type: [PartnerProviderDto] })
  list(@CurrentUser() user: AuthUser): Promise<PartnerProviderDto[]> {
    return this.partner.listProviders(user.id);
  }

  @Post('providers')
  @ApiOperation({ summary: 'Cadastra fornecedor (fica PENDING até a moderação aprovar)' })
  @ApiCreatedResponse({ type: PartnerProviderDto })
  @ApiBadRequestResponse()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderDto): Promise<PartnerProviderDto> {
    return this.partner.createProvider(user.id, dto);
  }

  @Get('providers/:id')
  @ApiOkResponse({ type: PartnerProviderDto })
  @ApiNotFoundResponse()
  get(@CurrentUser() user: AuthUser, @Param('id', Uuid()) id: string): Promise<PartnerProviderDto> {
    return this.partner.getProvider(user.id, id);
  }

  @Patch('providers/:id')
  @ApiOperation({ summary: 'Edita fornecedor (se já aprovado, volta para a moderação)' })
  @ApiOkResponse({ type: PartnerProviderDto })
  @ApiNotFoundResponse()
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: UpdateProviderDto,
  ): Promise<PartnerProviderDto> {
    return this.partner.updateProvider(user.id, id, dto);
  }

  @Delete('providers/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove fornecedor e todas as ofertas dele' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async remove(@CurrentUser() user: AuthUser, @Param('id', Uuid()) id: string): Promise<void> {
    await this.partner.deleteProvider(user.id, id);
  }

  @Post('providers/:id/locations')
  @ApiOperation({ summary: 'Adiciona endereço físico (usado para distância e "ir até o local")' })
  @ApiCreatedResponse({ type: PartnerProviderDto })
  @ApiNotFoundResponse()
  addLocation(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: CreateLocationDto,
  ): Promise<PartnerProviderDto> {
    return this.partner.addLocation(user.id, id, dto);
  }

  @Delete('locations/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async removeLocation(@CurrentUser() user: AuthUser, @Param('id', Uuid()) id: string): Promise<void> {
    await this.partner.deleteLocation(user.id, id);
  }

  @Post('providers/:id/listings')
  @ApiOperation({ summary: 'Cria oferta (fica PENDING até a moderação aprovar)' })
  @ApiCreatedResponse({ type: PartnerListingDto })
  @ApiNotFoundResponse()
  createListing(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: CreateListingDto,
  ): Promise<PartnerListingDto> {
    return this.partner.createListing(user.id, id, dto);
  }

  @Get('listings/:id')
  @ApiOkResponse({ type: PartnerListingDto })
  @ApiNotFoundResponse()
  getListing(@CurrentUser() user: AuthUser, @Param('id', Uuid()) id: string): Promise<PartnerListingDto> {
    return this.partner.getListing(user.id, id);
  }

  @Patch('listings/:id')
  @ApiOperation({ summary: 'Edita oferta (se já aprovada, volta para a moderação)' })
  @ApiOkResponse({ type: PartnerListingDto })
  @ApiNotFoundResponse()
  updateListing(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: UpdateListingDto,
  ): Promise<PartnerListingDto> {
    return this.partner.updateListing(user.id, id, dto);
  }

  @Delete('listings/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async removeListing(@CurrentUser() user: AuthUser, @Param('id', Uuid()) id: string): Promise<void> {
    await this.partner.deleteListing(user.id, id);
  }

  @Post('listings/:id/coverage')
  @ApiOperation({
    summary: 'Declara onde a oferta atende (raio, polígono ou condomínio)',
    description: 'Nasce não verificada: na busca aparece como "UNCONFIRMED" até a equipe verificar.',
  })
  @ApiCreatedResponse({ type: PartnerListingDto })
  @ApiBadRequestResponse({ description: 'Geometria inválida, grande demais ou comunidade inexistente' })
  @ApiNotFoundResponse()
  addCoverage(
    @CurrentUser() user: AuthUser,
    @Param('id', Uuid()) id: string,
    @Body() dto: CreateCoverageDto,
  ): Promise<PartnerListingDto> {
    return this.partner.addCoverage(user.id, id, dto);
  }

  @Delete('coverage/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async removeCoverage(@CurrentUser() user: AuthUser, @Param('id', Uuid()) id: string): Promise<void> {
    await this.partner.deleteCoverage(user.id, id);
  }
}
