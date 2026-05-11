# Research: Phase 10 AI Integration

## 1. Technical Feasibility Analysis

### Client-side API Calls vs Web LLM
- **Option A: API-based (Gemini/OpenAI)**
  - Pros: High quality, low device resource usage.
  - Cons: Requires API Key management (security risk in client-side apps), internet dependent.
  - Mitigation: User-provided API keys stored in IndexedDB.
- **Option B: Web LLM (e.g., Transformers.js, WebLLM)**
  - Pros: 100% Offline, high privacy, no cost per request.
  - Cons: High initial download (models > 1GB), requires high-end device (GPU/NPU).

### Proposed Approach
- 기본적으로 **Option A (Google Gemini API)**를 채택하여 빠른 구현과 높은 품질을 확보하고, 사용자가 자신의 API 키를 직접 등록하여 사용하게 함으로써 서버 비용 문제를 해결합니다.
- 향후 경량 모델(Gemma-2b 등)을 통한 **Option B** 실험 병행.

## 2. Use Case: AI Analytics
- `history` 데이터를 AI에게 전달하여 "지난달 대비 식비가 20% 증가했습니다. 배달 앱 사용을 줄여보시는 건 어떨까요?"와 같은 코칭 메시지 생성.
- `ComparisonEngine` 결과를 텍스트화하여 AI에게 맥락 제공.

## 3. Use Case: AI Tax Advisor
- `[[Financial_Taxation_Reference]]`의 내용을 시스템 프롬프트에 주입.
- 현재 배당 시뮬레이션 결과와 대조하여 "내년 예상 배당금이 1,900만 원으로 과세주의 구간에 진입합니다."와 같은 조언 생성.

## 4. UI/UX Design
- **AI Sidebar**: 메인 대시보드 옆에 상시 노출되거나 모달 형태로 제공되는 대화창.
- **Auto-Generation**: 차트 하단에 AI가 생성한 '오늘의 인사이트' 섹션 추가.

## 5. Privacy & Security
- 모든 대화 내용은 서버에 저장하지 않으며 로컬 IndexedDB에만 보관.
- 개인 식별 정보(이름 등)는 전송 전 마스킹 처리 고려.
