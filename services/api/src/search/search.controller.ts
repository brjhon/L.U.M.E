import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto, SearchResponseDto } from './search.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca ofertas para um endereço',
    description:
      'Classifica cada oferta pela cobertura declarada. Por padrão omite quem declara não atender o endereço.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiBadRequestResponse({ description: 'Parâmetros inválidos' })
  find(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.search.search(query);
  }
}
