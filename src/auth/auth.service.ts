import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service.js';
import { dummyHash, verifyPassword } from './password.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

type LoginResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const user = await this.users.findCredentialsByUsername(dto.username);
    const valid = await verifyPassword(
      dto.password,
      user ? user.passwordHash : dummyHash,
    );

    // Mismo 401 tanto si el username no existe como si la contraseña es
    // incorrecta: no informamos cuál de las dos falló.
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueToken(user.id);
  }

  /**
   * Registro público: crea siempre una cuenta PLAYER y devuelve un token,
   * de modo que la persona queda autenticada sin un segundo login.
   */
  async register(dto: RegisterDto): Promise<LoginResponse> {
    let user: { id: string };
    try {
      user = await this.users.create({
        username: dto.username,
        password: dto.password,
        role: UserRole.PLAYER,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException('Ese nombre de usuario ya está en uso');
      }
      throw error;
    }

    return this.issueToken(user.id);
  }

  private async issueToken(userId: string): Promise<LoginResponse> {
    const access_token = await this.jwt.signAsync({ sub: userId });
    const payload = this.jwt.decode<{ exp: number; iat: number }>(access_token);

    return {
      access_token,
      token_type: 'Bearer',
      expires_in: payload.exp - payload.iat,
    };
  }
}
