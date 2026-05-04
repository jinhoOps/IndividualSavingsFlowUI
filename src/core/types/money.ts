/**
 * Branded Types for currency consistency.
 * Prevents accidental mixing of 'Won' and 'ManWon' in calculations.
 */

export type Won = number & { readonly __brand: unique symbol };
export type ManWon = number & { readonly __brand: unique symbol };

export const MoneyUtils = {
  /**
   * Converts Man-Won to Won (Multiplies by 10,000).
   */
  toWon: (manwon: number | ManWon): Won => (Math.round(Number(manwon) * 10000)) as Won,

  /**
   * Converts Won to Man-Won (Divides by 10,000).
   */
  toMan: (won: number | Won): ManWon => (Number(won) / 10000) as ManWon,

  /**
   * Formats Won as a locale string with '만원' unit.
   */
  formatMan: (won: number | Won): string => {
    const man = Number(won) / 10000;
    return `${man.toLocaleString(undefined, { maximumFractionDigits: 2 })} 만원`;
  }
};
