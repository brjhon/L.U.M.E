import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PLATFORM_ROLES, type AuthResponse, type Me, type PlatformRole } from '@lume/types';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Senhas: mínimo 10 caracteres (NIST 800-63B prefere comprimento a regras de composição). */
const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;
const PHONE = /^\d{12,13}$/;
const PHONE_MESSAGE = 'Telefone: só dígitos, com 55 e DDD (ex.: 5511999990000)';
const PASSWORD_MESSAGE = `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres`;

export class RegisterDto {
  @ApiProperty({ example: 'Maria Souza' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'maria@exemplo.com.br' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: PASSWORD_MESSAGE })
  @MaxLength(PASSWORD_MAX)
  password!: string;

  @ApiPropertyOptional({ example: '5511999990000', description: 'Só dígitos, com DDI e DDD' })
  @IsOptional()
  @Transform(trim)
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'maria@exemplo.com.br' })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token recebido no login ou na última renovação' })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refreshToken!: string;
}

export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'null remove o telefone' })
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Transform(trim)
  @Matches(PHONE, { message: PHONE_MESSAGE })
  phone?: string | null;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(PASSWORD_MAX)
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX })
  @IsString()
  @MinLength(PASSWORD_MIN, { message: PASSWORD_MESSAGE })
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}

export class MeDto implements Me {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ enum: PLATFORM_ROLES }) role!: PlatformRole;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class AuthResponseDto implements AuthResponse {
  @ApiProperty() accessToken!: string;
  @ApiProperty({ description: 'Segundos até o token de acesso expirar' }) expiresIn!: number;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ format: 'date-time' }) refreshTokenExpiresAt!: string;
  @ApiProperty({ type: MeDto }) user!: MeDto;
}
