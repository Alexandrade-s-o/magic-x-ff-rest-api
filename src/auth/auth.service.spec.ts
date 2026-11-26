import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService.register', () => {
  const create = jest.fn<UsersService['create']>();
  const users = { create } as unknown as UsersService;
  const jwt = {
    signAsync: jest.fn(async () => 'signed.jwt.token'),
    decode: jest.fn(() => ({ iat: 1000, exp: 87400 })),
  } as unknown as JwtService;
  const service = new AuthService(users, jwt);

  beforeEach(() => create.mockReset());

  it('always creates a PLAYER account and returns a token', async () => {
    create.mockResolvedValue({
      id: 'user-1',
      username: 'nuevo_jugador',
      role: UserRole.PLAYER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register({
      username: 'nuevo_jugador',
      password: 'Password123!',
    });

    expect(create).toHaveBeenCalledWith({
      username: 'nuevo_jugador',
      password: 'Password123!',
      role: UserRole.PLAYER,
    });
    expect(result).toEqual({
      access_token: 'signed.jwt.token',
      token_type: 'Bearer',
      expires_in: 86400,
    });
  });

  it('reports a taken username as a 409 with a readable message', async () => {
    create.mockRejectedValue(new ConflictException('Username already exists'));

    await expect(
      service.register({
        username: 'jugador_prueba',
        password: 'Password123!',
      }),
    ).rejects.toThrow('Ese nombre de usuario ya está en uso');
  });
});
