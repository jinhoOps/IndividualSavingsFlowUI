---
type: node
created: 2026-05-04
status: evergreen
tags: [operating_principles, governance, modernization]
---

# 📝 Operating Principles (프로젝트 운영 원칙)

IndividualSavingsFlowUI 프로젝트는 **"현대적 DX를 통한 무결성 수호"**와 **"LLM Wiki 기반 지식 복리 적립"**을 최우선 가치로 삼습니다.

## ⚖️ 핵심 헌법 (Core Pillars)
- **시스템 무결성 (Integrity)**: UI/UX뿐만 아니라 데이터 정합성을 최우선으로 합니다. TypeScript를 사용하여 '원/만원' 단위 실수를 원천 차단하십시오.
- **현대적 DX (Modern Infrastructure)**: Vite, TS, Tailwind v4를 활용하여 에이전트와 개발자 모두가 효율적으로 작업할 수 있는 환경을 유지합니다.
- **LLM Wiki 패러다임**: 모든 지식은 단순히 기록되는 것이 아니라, 기존 지식과 합성되어 복리로 축적되어야 합니다.

## 🚀 개발 및 커밋 원칙
- **탐색 우선**: 개발 전 `.gemini/knowledge/wiki/` 및 `src/core/`의 현대적 자산을 먼저 확인합니다.
- **버전 관리**: [[Version_Management_Principles]] 문서에 정의된 체계를 따르며, GitHub Actions를 통한 자동 배포를 적극 활용합니다.
- **브랜치 전략**: POC 또는 대규모 아키텍처 변경은 반드시 별도 브랜치(`feat/*`, `refactor/*`)에서 검증 후 `main`에 병합합니다.

## 🛠️ 기술 및 PWA 동기화 (Automated Sync)
- **v1.1.0+**: 더 이상 `sw.js`나 버전 번호를 수동으로 고치지 않습니다. 
  - `package.json`의 버전을 SSOT(Single Source of Truth)로 삼습니다.
  - 빌드 시 `vite-plugin-pwa`가 PWA 캐시 갱신 로직을 자동 생성합니다.
  - GitHub Actions가 `feat/modern-poc` 및 `main` 브랜치 푸시 시 자동 배포를 수행합니다.

## 🏛️ 지식 베이스 운영 (The Librarian Workflow)
- 모든 지식은 `.gemini/knowledge/wiki/` 디렉토리에서 위키 노드 형태로 관리됩니다.
- 현대화로 인해 유효하지 않게 된 과거 기록은 아카이브 디렉토리로 이동하거나 `[ARCHIVED]` 표기를 추가합니다.

---
*연결 노드:* [[Project_History]], [[Architecture_Reference]]
