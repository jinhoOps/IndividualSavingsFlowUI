# Phase 10: AI Integration (지능형 자산 분석 및 자문)

## 📌 Context Overview
이 단계는 ISF 프로젝트를 단순한 시각화 도구에서 인공지능 기반의 지능형 자산 관리 비서로 진화시키는 것을 목표로 합니다. 사용자의 데이터를 기반으로 지출 패턴을 분석하고, 복잡한 세무 정책을 설명하며, 미래 시나리오에 따른 자산 변화를 예측합니다.

## 🎯 Goals
1. **AI Analytics**: 과거 지출 스냅샷을 비교하여 비정상적 지출을 감지하고 최적화 제안.
2. **AI Tax Advisor**: 금융소득종합과세 등 복잡한 세금 관련 질문에 대해 현재 포트폴리오 기반 답변 제공.
3. **Smart Scenario**: 사용자가 자연어로 입력한 시나리오(예: "금리가 1% 오르면 내 자산은?")를 시뮬레이션 파라미터로 변환.

## 🧩 Key Features
- **Insight Dashboard**: AI가 요약한 가계 흐름 리포트 제공.
- **Natural Language Simulation**: 대화형 인터페이스를 통한 백테스트 파라미터 조정.
- **Tax Guard**: 과세 임계점에 도달할 경우 AI가 선제적으로 경고하고 대안 제시.

## 🛠 Tech Stack (Candidate)
- **Engine**: OpenAI API, Google Gemini API, or Web LLM (Client-side execution).
- **Architecture**: 서버리스 구조 유지를 위해 클라이언트 사이드에서 직접 API를 호출하거나 로컬 모델 활용.
- **Vector DB**: 지출 패턴 검색을 위한 경량 클라이언트 사이드 임베딩 고려.

## 📈 Success Criteria
1. 지출 분석 시 사용자 데이터와 90% 이상의 정합성을 가진 인사이트 도출.
2. 금융소득종합과세 기준에 따른 정확한 세무 가이드 제공.
3. 자연어 시나리오 입력을 통한 시뮬레이션 실행 성공률 80% 이상.
