import type Groq from 'groq-sdk';

/** Token de inyección del cliente de Groq (null si falta GROQ_API_KEY). */
export const GROQ_CLIENT = Symbol('GROQ_CLIENT');

/** Lo único que el asesor usa del SDK; facilita sustituirlo en las pruebas. */
export type AdvisorLlmClient = Pick<Groq, 'chat'>;

/** Modelo de Groq por defecto; se cambia con la variable GROQ_MODEL. */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
