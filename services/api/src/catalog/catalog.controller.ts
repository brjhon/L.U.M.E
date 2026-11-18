import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CategoryDto, ContactEventDto, ListingDetailDto, ListingDetailQueryDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller({ version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @ApiOkResponse({ type: [CategoryDto] })
  categories(): Promise<CategoryDto[]> {
    return this.catalog.categories();
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Detalhe de uma oferta com contatos do fornecedor' })
  @ApiOkResponse({ type: ListingDetailDto })
  @ApiNotFoundResponse()
  listing(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ListingDetailQueryDto,
  ): Promise<ListingDetailDto> {
    return this.catalog.listing(id, query);
  }

  @Post('listings/:id/contact-events')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registra clique em Ligar / WhatsApp / Como chegar (métrica de conversão)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async contact(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: ContactEventDto): Promise<void> {
    await this.catalog.recordContact(id, body);
  }
}
