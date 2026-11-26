import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Registro público. No acepta `role`: el ValidationPipe global rechaza
 * propiedades extra (forbidNonWhitelisted), así que nadie puede registrarse
 * como ADMINISTRATOR. Las cuentas nuevas son siempre PLAYER.
 */
export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El usuario debe ser texto' })
  @Matches(/^[A-Za-z0-9_.-]{3,30}$/, {
    message:
      'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo',
  })
  username!: string;

  @IsString({ message: 'La contraseña debe ser texto' })
  @Matches(/\S/, { message: 'La contraseña no puede estar en blanco' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, {
    message: 'La contraseña no puede tener más de 128 caracteres',
  })
  password!: string;
}
