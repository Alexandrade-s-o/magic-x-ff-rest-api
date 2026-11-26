import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AdvisorMessageDto {
  @IsIn(['user', 'assistant'], {
    message: 'El rol de cada mensaje debe ser "user" o "assistant"',
  })
  role!: 'user' | 'assistant';

  @IsString({ message: 'El mensaje debe ser texto' })
  @MinLength(1, { message: 'El mensaje no puede estar vacío' })
  @MaxLength(4000, {
    message: 'Cada mensaje puede tener hasta 4000 caracteres',
  })
  content!: string;
}

/**
 * La conversación vive en el navegador: cada petición envía el historial
 * reciente (como máximo 20 mensajes) y el último debe ser del usuario.
 */
export class AdvisorChatDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Envía al menos un mensaje' })
  @ArrayMaxSize(20, { message: 'Envía como máximo 20 mensajes' })
  @ValidateNested({ each: true })
  @Type(() => AdvisorMessageDto)
  messages!: AdvisorMessageDto[];

  @IsOptional()
  @IsIn(['es', 'en'], { message: 'El idioma debe ser "es" o "en"' })
  language?: 'es' | 'en';
}
