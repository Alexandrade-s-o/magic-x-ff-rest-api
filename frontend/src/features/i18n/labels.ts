import type { Dictionary } from '@/i18n';

const SET_NAMES: Record<string, string> = {
  HOB: 'The Hobbit',
  FIN: 'Final Fantasy',
  FRA: 'Reality Fracture',
};

/** Nombre de la colección; los nombres oficiales no se traducen. */
export function setName(code: string): string {
  return SET_NAMES[code] ?? code;
}

/** Rareza en el idioma activo (la base guarda common, rare…). */
export function rarityLabel(name: string, dict: Dictionary): string {
  const key = name.toLowerCase() as keyof Dictionary['rarities'];
  return dict.rarities[key] ?? name;
}
