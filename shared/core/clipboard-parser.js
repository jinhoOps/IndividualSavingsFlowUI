/**
 * Smart Clipboard Parser for ISF
 * Extracts transaction details (amount, merchant, date) from bank/card SMS strings.
 */

export const ClipboardParser = {
  /**
   * Common patterns for Korean bank/card SMS
   */
  PATTERNS: [
    // Shinhan Card: [Web발신] 신한카드승인 이*호(6115) 05/11 14:20 15,600원(일시불) 쿠팡
    {
      name: 'Shinhan',
      regex: /신한카드승인.*?\s(\d{2}\/\d{2})\s\d{2}:\d{2}\s([\d,]+)원.*?\s(.+)$/m,
      map: (match) => ({ date: match[1], amount: parseInt(match[2].replace(/,/g, ''), 10), merchant: match[3].trim() })
    },
    // Hyundai Card: [현대카드]-승인 이*호 15,600원(일시불) 05/11 14:20 쿠팡
    {
      name: 'Hyundai',
      regex: /\[현대카드\]-승인.*?\s([\d,]+)원.*?\s(\d{2}\/\d{2})\s\d{2}:\d{2}\s(.+)$/m,
      map: (match) => ({ date: match[2], amount: parseInt(match[1].replace(/,/g, ''), 10), merchant: match[3].trim() })
    },
    // Toss Bank: [토스뱅크] 05/11 14:20 이*호님에게 15,600원 결제(쿠팡)
    {
      name: 'Toss',
      regex: /\[토스뱅크\]\s(\d{2}\/\d{2})\s\d{2}:\d{2}.*?\s([\d,]+)원\s결제\((.+)\)/,
      map: (match) => ({ date: match[1], amount: parseInt(match[2].replace(/,/g, ''), 10), merchant: match[3].trim() })
    },
    // Generic KakaoBank / KB Kookmin style: KB카드 05/11 14:20 15,600원 쿠팡 승인
    {
      name: 'Generic',
      regex: /(\d{2}\/\d{2})\s\d{2}:\d{2}\s([\d,]+)원\s(.+?)(?:\s|$)/,
      map: (match) => ({ date: match[1], amount: parseInt(match[2].replace(/,/g, ''), 10), merchant: match[3].trim() })
    }
  ],

  /**
   * Parses a raw text string into a transaction object.
   * @param {string} text 
   * @returns {Object|null}
   */
  parseSms(text) {
    if (!text) return null;
    const cleanText = text.replace(/\r?\n/g, ' ').trim();

    for (const pattern of this.PATTERNS) {
      const match = cleanText.match(pattern.regex);
      if (match) {
        try {
          const result = pattern.map(match);
          return {
            ...result,
            source: pattern.name,
            raw: text
          };
        } catch (e) {
          console.error(`Parser error in ${pattern.name}:`, e);
        }
      }
    }

    // Fallback: Just look for any currency pattern and date
    const amountMatch = cleanText.match(/([\d,]{2,})원/);
    const dateMatch = cleanText.match(/(\d{1,2}\/\d{1,2})/);
    if (amountMatch) {
      return {
        amount: parseInt(amountMatch[1].replace(/,/g, ''), 10),
        date: dateMatch ? dateMatch[1] : null,
        merchant: '알 수 없는 상점',
        source: 'Fallback',
        raw: text
      };
    }

    return null;
  },

  /**
   * Finds the best matching category from existing items.
   * @param {string} merchant 
   * @param {Array} existingItems - Array of { name, group }
   * @returns {Object|null}
   */
  matchCategory(merchant, existingItems = []) {
    if (!merchant || existingItems.length === 0) return null;
    
    // Simple exact or partial match first
    const exact = existingItems.find(item => merchant.includes(item.name) || item.name.includes(merchant));
    if (exact) return exact;

    // TODO: Implement fuzzy matching (Levenshtein) if needed
    return null;
  }
};
