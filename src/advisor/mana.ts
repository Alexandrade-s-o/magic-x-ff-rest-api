/**
 * Utilidades de coste de maná. La tabla Card guarda el coste como texto
 * ("{2}{W}{U}"), así que el asesor deriva aquí el valor de maná y los colores.
 */
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;
export type ManaColor = (typeof COLOR_ORDER)[number];

const SYMBOL = /\{([^}]+)\}/g;

function isColor(value: string): value is ManaColor {
  return (COLOR_ORDER as readonly string[]).includes(value);
}

/** Valor de maná (CMC): {2}{W}{U} = 4; {X} = 0; {2/W} = 2; {W/U} = 1. */
export function manaValue(manaCost: string | null | undefined): number {
  if (!manaCost) return 0;

  let total = 0;
  for (const [, raw] of manaCost.matchAll(SYMBOL)) {
    const symbol = raw.toUpperCase();
    if (/^\d+$/.test(symbol)) {
      total += Number(symbol);
    } else if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') {
      continue;
    } else if (symbol.includes('/')) {
      const first = symbol.split('/')[0];
      total += /^\d+$/.test(first) ? Number(first) : 1;
    } else {
      total += 1;
    }
  }
  return total;
}

/** Colores del coste en orden WUBRG, incluidos los de símbolos híbridos. */
export function manaColors(manaCost: string | null | undefined): ManaColor[] {
  if (!manaCost) return [];

  const found = new Set<ManaColor>();
  for (const [, raw] of manaCost.matchAll(SYMBOL)) {
    for (const part of raw.toUpperCase().split('/')) {
      if (isColor(part)) found.add(part);
    }
  }
  return COLOR_ORDER.filter((color) => found.has(color));
}
