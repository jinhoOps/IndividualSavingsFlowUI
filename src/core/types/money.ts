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
   * Converts Won to Man-Won (Divides by 10,000 and rounds to integer).
   */
  toMan: (won: number | Won): ManWon => Math.round(Number(won) / 10000) as ManWon,

  /**
   * Formats Won as a locale string with '만원' unit, converting to '억원' if >= 10,000 ManWon.
   */
  formatMan: (won: number | Won): string => {
    const numericValue = Number(won || 0);
    const manValue = Math.round(numericValue / 10000);

    if (manValue >= 10000) {
      const eok = Math.floor(manValue / 10000);
      const remainMan = manValue % 10000;
      if (remainMan === 0) {
        return `${eok.toLocaleString('ko-KR')} 억원`;
      }
      return `${eok.toLocaleString('ko-KR')} 억 ${remainMan.toLocaleString('ko-KR')} 만원`;
    }

    return `${manValue.toLocaleString('ko-KR')} 만원`;
  }
};
