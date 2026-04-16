---
type: node
created: 2026-04-14
status: evergreen
tags: [operating_principles, governance]
---

# 📝 Operating Principles (프로젝트 운영 원칙)

IndividualSavingsFlowUI 프로젝트는 **"스타일 및 반응형 무결성"** 수호와 **"LLM Wiki 기반 지식 복리 적립"**을 최우선 가치로 삼습니다.

## ⚖️ 핵심 헌법 (Core Pillars)
- **스타일 및 반응형 무결성**: UI/UX는 데이터와 동등한 가치를 가집니다. 물리적 파일 구조(특히 `@media` 쿼리)를 보존하고 모바일 대응력을 유지하십시오.
- **LLM Wiki 패러다임**: 모든 지식은 단순히 기록되는 것이 아니라, 기존 지식과 합성되어 복리로 축적되어야 합니다.

## 🚀 개발 및 커밋 원칙
- **탐색 우선**: 개발 전 `.gemini/knowledge/wiki/` 및 `shared/` 디렉토리의 기존 자산을 먼저 확인합니다.
- **버전 관리**: 당분간 `0.x` (pre-1.0) 체계를 유지하며, `feat`은 minor up, 그 외는 patch up을 적용합니다.
- **태그 규칙**: `feat:`, `fix:`, `docs:`, `chore:` 기본 4종을 사용하며, 특수 상황에만 `refactor:`, `test:`, `perf:`를 사용합니다.

## 🛠️ PWA 및 기술 동기화
- PWA 관련 변경 시 아래 세 가지 파일의 버전을 반드시 동기화합니다:
  - `apps/step1/app.js` (또는 각 앱의 `APP_VERSION`)
  - `sw.js` (CACHE_NAME)
  - `manifest.webmanifest` (version)

## 🏛️ 지식 베이스 운영 (The Librarian Workflow)
- 모든 지식은 `.gemini/knowledge/wiki/` 디렉토리에서 위키 노드 형태로 관리됩니다.
- 자세한 내용은 [[Knowledge_Harness]] 문서를 참조하십시오.

---
*연결 노드:* [[Project_History]]
