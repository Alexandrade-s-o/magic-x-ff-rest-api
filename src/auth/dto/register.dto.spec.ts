import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

describe('RegisterDto validation', () => {
  const validationOptions = {
    whitelist: true,
    forbidNonWhitelisted: true,
  };

  const check = (payload: Record<string, unknown>) =>
    validate(plainToInstance(RegisterDto, payload), validationOptions);

  it('accepts a valid registration and trims the username', async () => {
    const dto = plainToInstance(RegisterDto, {
      username: '  nuevo_jugador ',
      password: 'Password123!',
    });

    expect(dto.username).toBe('nuevo_jugador');
    expect(await validate(dto, validationOptions)).toHaveLength(0);
  });

  it('rejects usernames that are too short or contain spaces', async () => {
    expect(
      await check({ username: 'ab', password: 'Password123!' }),
    ).toHaveLength(1);
    expect(
      await check({ username: 'con espacio', password: 'Password123!' }),
    ).toHaveLength(1);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const errors = await check({ username: 'jugador', password: 'corta' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('password');
  });

  it('rejects a role sent by the client', async () => {
    const errors = await check({
      username: 'jugador',
      password: 'Password123!',
      role: 'ADMINISTRATOR',
    });

    expect(errors.map((error) => error.property)).toContain('role');
  });
});
