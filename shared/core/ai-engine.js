/**
 * AI Engine for ISF
 * Handles communication with LLM APIs (Gemini, OpenAI) for financial insights.
 */

export const AiEngine = {
  SYSTEM_PROMPT: `당신은 금융 전문가이자 자산 관리 비서입니다. 
  사용자의 수입, 지출, 저축, 투자 데이터를 분석하여 실질적인 인사이트를 제공합니다.
  항상 친절하고 전문적인 톤을 유지하며, 구체적인 수치(만원, % 등)를 언급하십시오.
  금융소득종합과세(2,000만 원 기준) 및 국내 세무 정책을 잘 알고 있습니다.`,

  /**
   * Generates financial insights based on user data.
   */
  async generateInsight(data, apiKey) {
    if (!apiKey) throw new Error("API Key is required");

    const prompt = `다음은 사용자의 현재 가계 흐름 데이터입니다:
    ${JSON.stringify(data, null, 2)}
    
    이 데이터를 바탕으로 지출 최적화 제안과 향후 자산 성장 전망을 3문장 이내로 요약해줘.`;

    return await this._callApi(prompt, apiKey);
  },

  /**
   * Internal helper to call Gemini API
   */
  async _callApi(prompt, apiKey) {
    // Actual implementation would use fetch() to Google Gemini API
    // For now, returning simulated expert response
    await new Promise(resolve => setTimeout(resolve, 1500));

    return `[AI 분석 결과] 
    1. 수입 대비 저축/투자 비중이 35%로 매우 건강한 상태입니다. 
    2. 다만, '기타 지출' 항목의 비중이 높아 세부 분류를 통한 관리가 필요해 보입니다.
    3. 현재 추세라면 5년 내 순자산 5억 달성이 가능할 것으로 예측됩니다.`;
  },

  /**
   * Answers tax or financial strategy questions.
   * @param {string} query 
   * @param {Object} portfolio 
   * @param {string} apiKey 
   */
  async answerTaxQuestion(query, portfolio, apiKey) {
    if (!apiKey) throw new Error("API Key is required");

    // Placeholder for actual API call
    console.log("Answering question:", query);

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (query.includes("세금")) {
      return `현재 예상 연 배당금은 ${portfolio.finalAnnualDividend.toLocaleString()}원입니다. 
      국내 금융소득종합과세 기준인 2,000만 원 이하에 해당하므로, 15.4% 원천징수 후 추가 세금 부담은 없습니다. 
      하지만 ISA 계좌 활용 시 비과세 혜택을 극대화할 수 있습니다.`;
    }

    return "요청하신 분석을 수행하기 위해 더 구체적인 정보가 필요합니다.";
  }
};
