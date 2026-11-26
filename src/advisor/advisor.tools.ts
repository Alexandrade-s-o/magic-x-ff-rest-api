import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service.js';
import { manaColors, manaValue, type ManaColor } from './mana.js';

const SET_CODES = ['FIN', 'HOB', 'FRA'] as const;
const RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const;
const COLORS: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

/**
 * Herramientas que el LLM puede pedir. Todas son de SOLO LECTURA y el usuario
 * sale siempre del JWT (parámetro `userId`), nunca de los argumentos del modelo.
 */
export const ADVISOR_TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_cards',
      description:
        'Busca cartas del catálogo (colecciones FIN = Final Fantasy, HOB = The Hobbit, FRA = Reality Fracture). Úsala antes de recomendar cualquier carta. Devuelve como máximo 25 cartas.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Texto a buscar en el nombre, el tipo o el texto de reglas (en inglés, p. ej. "dragon", "draw a card", "flying").',
          },
          setCode: {
            type: 'string',
            enum: [...SET_CODES],
            description: 'Colección.',
          },
          rarity: {
            type: 'string',
            enum: [...RARITIES],
            description: 'Rareza.',
          },
          type: {
            type: 'string',
            description:
              'Parte de la línea de tipo, en inglés: "Creature", "Instant", "Land", "Goblin"…',
          },
          colors: {
            type: 'array',
            items: { type: 'string', enum: [...COLORS] },
            description:
              'Colores que debe tener el coste: W blanco, U azul, B negro, R rojo, G verde.',
          },
          maxManaValue: {
            type: 'integer',
            minimum: 0,
            maximum: 16,
            description: 'Valor de maná máximo (CMC).',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 25,
            description: 'Cuántas cartas devolver (10 por defecto).',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_card',
      description:
        'Devuelve el detalle completo de una carta por su id (texto de reglas completo, fuerza y resistencia).',
      parameters: {
        type: 'object',
        properties: {
          cardId: { type: 'integer', description: 'Id de la carta.' },
        },
        required: ['cardId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_collection',
      description:
        'Devuelve las cartas que el usuario tiene en su colección personal, con cantidad y si son foil.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

type CardWithRelations = Prisma.CardGetPayload<{
  include: { rarity: true; cardType: true };
}>;

function truncate(text: string | null, max: number): string | null {
  if (!text) return text;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function summarize(card: CardWithRelations, textLimit: number) {
  return {
    id: card.id,
    name: card.name,
    set: card.setCode,
    manaCost: card.manaCost,
    manaValue: manaValue(card.manaCost),
    colors: manaColors(card.manaCost),
    type: card.cardType.name,
    rarity: card.rarity.name,
    power: card.power,
    toughness: card.toughness,
    text: truncate(card.oracleText, textLimit),
  };
}

function optionalString(value: unknown, max = 80): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function optionalInt(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) return undefined;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  const text = optionalString(value);
  if (!text) return undefined;
  return allowed.find((option) => option.toLowerCase() === text.toLowerCase());
}

@Injectable()
export class AdvisorTools {
  private readonly logger = new Logger(AdvisorTools.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ejecuta una herramienta. Nunca lanza: los fallos vuelven como `{error}`. */
  async run(name: string, rawArgs: string, userId: string): Promise<unknown> {
    let args: Record<string, unknown>;
    try {
      const parsed: unknown = rawArgs ? JSON.parse(rawArgs) : {};
      args =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
    } catch {
      return { error: 'Los argumentos de la herramienta no son JSON válido.' };
    }

    try {
      switch (name) {
        case 'search_cards':
          return await this.searchCards(args);
        case 'get_card':
          return await this.getCard(args);
        case 'get_my_collection':
          return await this.getMyCollection(userId);
        default:
          return { error: `Herramienta desconocida: ${name}` };
      }
    } catch (error) {
      this.logger.error(`Fallo en la herramienta ${name}`, error as Error);
      return { error: 'No se pudo consultar la base de datos.' };
    }
  }

  private async searchCards(args: Record<string, unknown>) {
    const query = optionalString(args.query);
    const setCode = oneOf(args.setCode, SET_CODES);
    const rarity = oneOf(args.rarity, RARITIES);
    const type = optionalString(args.type, 60);
    const colors = Array.isArray(args.colors)
      ? [
          ...new Set(
            args.colors
              .map((c) => oneOf(c, COLORS))
              .filter((c) => c !== undefined),
          ),
        ]
      : [];
    const maxManaValue = optionalInt(args.maxManaValue, 0, 16);
    const limit = optionalInt(args.limit, 1, 25) ?? 10;

    const and: Prisma.CardWhereInput[] = [];
    if (query) {
      and.push({
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { oracleText: { contains: query, mode: 'insensitive' } },
          { cardType: { name: { contains: query, mode: 'insensitive' } } },
        ],
      });
    }
    if (setCode) and.push({ setCode });
    if (rarity) and.push({ rarity: { name: rarity } });
    if (type)
      and.push({ cardType: { name: { contains: type, mode: 'insensitive' } } });
    // En el coste solo aparecen símbolos, así que la letra basta para el color.
    for (const color of colors) and.push({ manaCost: { contains: color } });

    const rows = await this.prisma.card.findMany({
      where: { AND: and },
      include: { rarity: true, cardType: true },
      orderBy: [{ setCode: 'asc' }, { displayOrder: 'asc' }, { id: 'asc' }],
      take: maxManaValue === undefined ? limit : 200,
    });

    const cards = rows
      .map((card) => summarize(card, 280))
      .filter(
        (card) => maxManaValue === undefined || card.manaValue <= maxManaValue,
      )
      .slice(0, limit);

    return { found: cards.length, cards };
  }

  private async getCard(args: Record<string, unknown>) {
    const cardId = optionalInt(args.cardId, 1, Number.MAX_SAFE_INTEGER);
    if (cardId === undefined) return { error: 'Falta un cardId válido.' };

    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { rarity: true, cardType: true },
    });
    if (!card) return { error: `No existe una carta con id ${cardId}.` };

    return { ...summarize(card, 2000), artist: card.artist };
  }

  private async getMyCollection(userId: string) {
    const entries = await this.prisma.collectionEntry.findMany({
      where: { userId },
      include: { card: { include: { rarity: true, cardType: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    });

    return {
      uniqueCards: entries.length,
      totalCopies: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      cards: entries.map((entry) => ({
        ...summarize(entry.card, 120),
        quantity: entry.quantity,
        foil: entry.isFoil,
      })),
    };
  }
}
