import { manaColors, manaValue } from './mana.js';

describe('mana helpers', () => {
  it('computes the mana value of common costs', () => {
    expect(manaValue('{2}{W}{U}')).toBe(4);
    expect(manaValue('{X}{R}{R}')).toBe(2);
    expect(manaValue('{2/W}{W/U}')).toBe(3);
    expect(manaValue('{1}{G} // {3}{B}')).toBe(6);
    expect(manaValue(null)).toBe(0);
  });

  it('lists colors in WUBRG order, including hybrid symbols', () => {
    expect(manaColors('{R}{1}{W}')).toEqual(['W', 'R']);
    expect(manaColors('{B/G}{U/P}')).toEqual(['U', 'B', 'G']);
    expect(manaColors('{3}')).toEqual([]);
    expect(manaColors(undefined)).toEqual([]);
  });
});
