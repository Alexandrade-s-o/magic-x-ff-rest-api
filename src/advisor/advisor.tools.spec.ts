import { jest } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AdvisorTools } from './advisor.tools.js';

const card = (id: number, name: string, manaCost: string) => ({
  id,
  name,
  manaCost,
  oracleText: 'Haste',
  power: '2',
  toughness: '1',
  setCode: 'FIN',
  collectorNumber: String(id),
  artist: 'Someone',
  imageUrl: null,
  displayOrder: id,
  createdAt: new Date(),
  updatedAt: new Date(),
  rarityId: 1,
  cardTypeId: 1,
  rarity: { id: 1, name: 'common' },
  cardType: { id: 1, name: 'Creature — Goblin' },
});

describe('AdvisorTools', () => {
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const findEntries = jest.fn<(args: unknown) => Promise<unknown[]>>();
  const prisma = {
    card: { findMany, findUnique: jest.fn() },
    collectionEntry: { findMany: findEntries },
  } as unknown as PrismaService;
  const tools = new AdvisorTools(prisma);

  beforeEach(() => {
    findMany.mockReset();
    findEntries.mockReset();
  });

  it('builds the card filters from the model arguments', async () => {
    findMany.mockResolvedValue([
      card(1, 'Fast Goblin', '{R}'),
      card(2, 'Big Goblin', '{5}{R}'),
    ]);

    const result = (await tools.run(
      'search_cards',
      JSON.stringify({
        setCode: 'fin',
        rarity: 'Common',
        colors: ['R', 'X'],
        maxManaValue: 3,
      }),
      'user-1',
    )) as { found: number; cards: { name: string; manaValue: number }[] };

    const where = (findMany.mock.calls[0][0] as { where: { AND: unknown[] } })
      .where;
    expect(where.AND).toEqual([
      { setCode: 'FIN' },
      { rarity: { name: 'common' } },
      { manaCost: { contains: 'R' } },
    ]);
    expect(result.cards).toEqual([
      expect.objectContaining({ name: 'Fast Goblin', manaValue: 1 }),
    ]);
  });

  it('reads the collection of the authenticated user only', async () => {
    findEntries.mockResolvedValue([
      { quantity: 3, isFoil: false, card: card(1, 'Fast Goblin', '{R}') },
    ]);

    const result = (await tools.run(
      'get_my_collection',
      JSON.stringify({ userId: 'someone-else' }),
      'user-1',
    )) as { totalCopies: number };

    expect((findEntries.mock.calls[0][0] as { where: unknown }).where).toEqual({
      userId: 'user-1',
    });
    expect(result.totalCopies).toBe(3);
  });

  it('returns an error object instead of throwing', async () => {
    expect(await tools.run('search_cards', '{not json', 'user-1')).toEqual({
      error: expect.any(String),
    });
    expect(await tools.run('drop_tables', '{}', 'user-1')).toEqual({
      error: expect.stringContaining('desconocida'),
    });
  });
});
