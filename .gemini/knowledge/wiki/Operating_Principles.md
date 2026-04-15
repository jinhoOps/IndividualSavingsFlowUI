---
type: node
created: 2026-04-14
status: evergreen
tags: [operating_principles, governance]
---

# 📝 Operating Principles (프로젝트 운영 원칙)

IndividualSavingsFlowUI 프로젝트의 지속 가능한 개발과 일관성을 유지하기 위한 핵심 원칙입니다.

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
