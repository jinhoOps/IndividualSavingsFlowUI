---
type: node
created: 2026-05-04
tags: [history, timeline, legacy]
---

# Project History (프로젝트 연대기)

## 🕒 주요 마일스톤

### [2026-05-04] Phase 5: Step 1 Spotlight Onboarding (v0.8.3) 🌟
- 신규 사용자를 위한 프리셋 가이드 및 `IsfOnboardingManager` 구현 완료.
- 모바일 플로팅 툴팁 및 Spotlight 하이라이트 효과 고도화.
- 시스템 무결성 보호를 위한 방어적 리팩터링 및 UI 안정화 병행.

### [2026-05-04] Modernization Pivot (v1.1.0-alpha.1)
- **헌법 개정**: 'No-build' 원칙을 폐기하고 Vite, TypeScript, Tailwind v4 도입.
- **스토리지 혁명**: 레거시 DB(v1)를 과감히 정리하고 TS 기반 `isf-v2-db` 및 Branded Type 시스템 구축.
- **배포 자동화**: GitHub Actions를 통한 CI/CD 구축.
- **브랜치 분리**: `feat/modern-poc` 브랜치 생성 및 기술 검증.

### [2026-05-04] Phase 4: KPI Dashboard (v0.7.15)
- 시뮬레이션 결과 요약 KPI 카드 및 테이블 정제 완료.
- PWA 캐시 갱신을 위한 최후의 수동 Triple Sync 수행.

### [2026-04-20] System Integrity Recovery
- Step 1 모듈화 후 발생한 유실 모듈 복구 및 데이터 바인딩 정상화.

### [2026-04-18] Step 2 Modularization (v0.7.0)
- Step 2 로직을 7개 모듈로 분리 및 `IsfStorageHub` 통합 연동.

### [2026-04-17] Storage Hub Integration
- 파편화된 저장 로직을 `shared/storage/hub-storage.js`로 일원화.
- 자동 마이그레이션 및 뷰 모드 안전 저장 프로토콜 도입.

### [2026-04-16] Step 1 Modularization (v0.5.0)
- 단일 `app.js`를 11개 전문 모듈로 분리.
- Sankey Diagram 빌드 로직 고도화.

### [2026-04-14] UI/UX Overhaul (v0.3.0)
- Glassmorphism 테마 및 반응형 레이아웃 기본 체계 수립.

---
*연결 노드:* [[Operating_Principles]], [[Architecture_Reference]]
