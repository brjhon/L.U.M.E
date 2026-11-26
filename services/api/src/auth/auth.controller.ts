import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AuthResponseDto,
  ChangePasswordDto,
  DeleteAccountDto,
  LoginDto,
  MeDto,
  RefreshDto,
  RegisterDto,
  UpdateMeDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser, Public, type AuthUser } from './decorators';

@ApiTags('auth')
@Public()
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cria conta de usuário e já devolve a sessão' })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: 'E-mail ou telefone já cadastrado' })
  @ApiTooManyRequestsResponse()
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha incorretos' })
  @ApiTooManyRequestsResponse()
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Troca o refresh token por uma sessão nova',
    description: 'O token enviado deixa de valer. Reenviar um token já trocado encerra a sessão.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse()
  refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Encerra a sessão deste dispositivo' })
  @ApiNoContentResponse()
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }
}

@ApiTags('me')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Sem login ou sessão encerrada' })
@Controller({ path: 'me', version: '1' })
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOkResponse({ type: MeDto })
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.auth.me(user.id);
  }

  @Patch()
  @ApiOkResponse({ type: MeDto })
  @ApiConflictResponse({ description: 'Telefone já usado em outra conta' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto): Promise<MeDto> {
    return this.auth.updateMe(user.id, dto);
  }

  @Post('password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Troca a senha e encerra as sessões dos outros dispositivos' })
  @ApiOkResponse({ type: AuthResponseDto })
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<AuthResponseDto> {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Delete()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Exclui a conta e os dados pessoais (LGPD)',
    description:
      'Exige a senha. Apaga endereços, favoritos e vínculos; anonimiza avaliações e solicitações; ' +
      'tira do ar os fornecedores da pessoa; encerra todas as sessões. Não tem volta.',
  })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Único administrador da plataforma' })
  async deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto): Promise<void> {
    await this.auth.deleteAccount(user.id, dto.password);
  }
}
