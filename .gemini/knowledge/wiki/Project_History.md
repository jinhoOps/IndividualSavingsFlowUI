---
type: node
created: 2026-05-04
tags: [history, timeline, legacy]
---

# Project History (프로젝트 연대기)

## 🕒 주요 마일스톤

### [2026-05-06] Step 2 Preset UI Enhancement & Patch (v0.9.1) 🛠️
- **주요 내용**: 시뮬레이션 프리셋 선택 시 가시성 개선 및 전역 버전 패치.
- **성과**:
    - 프리셋 선택 시 우측 상단에 전략 명칭(Badge) 표시 로직 구현.
    - 입력값 수정 시 프리셋 상태를 자동으로 해제하여 사용자 혼선 방지.
    - 프로젝트 전반의 버전을 v0.9.1로 패치하여 PWA 캐시 무결성 확보.

### [2026-05-06] Modern Hybrid Architecture & Financial Simulation Enhancements (v0.9.0) 🚀
- **인프라 혁신**: Vite, TypeScript, TailwindCSS v4 도입 및 레거시 호환성 브릿지 구축 완료.
- **금융 로직 정교화**: 4% 안전 마진(1,920만/3,264만) 정책이 적용된 자동 소득세 계산 및 경고 시스템 통합.
- **UX 현대화**: Step 1 온보딩 스포트라이트 시스템 및 자산 트래킹 UI 고도화.
- **코드 품질**: 매직 넘버 제거 및 `TAX_CONFIG` 기반의 Self-documenting 코드 구조로 대규모 리팩터링 수행.
- **시스템 무결성**: Branded Types 도입 및 단위 정합성(만원/원) 수호 로직 강화.

### [2026-05-06] Step 2 초기 자산 연동 및 시뮬레이션 로직 수정 (v0.8.9)
- **버그 수정**: 배당 시뮬레이션이 항상 0원에서 시작하던 논리적 결함 해결.
- **데이터 브릿지 강화**: Step 1의 `startInvest` 데이터를 Step 2의 초기 원금으로 자동 연동.
- **UI 일관성**: 금융종합소득과세 경고 레이블을 '과세주의/과세경고'로 전면 통일.

### [2026-05-06] Step 1 초기 자산 필드 구조 개선 (v0.8.8)
- 초기 자산을 현금/저축/투자 3종으로 세분화하고 '간편 입력' 섹션으로 전면 배치.
- SimChart 시각적 버그 수정(축 라벨 잘림 방지) 및 타이포그래피 정제.

### [2026-05-04] Runtime Version Management Centralization (v0.8.3)
- UI 하드코딩된 버전 표기를 `IsfUtils.APP_VERSION`으로 변수화 및 일원화.
- `AppHeader` 및 PWA 매니저의 버전 참조 로직 동적화.
- "Triple Sync" 유지보수 비용 절감 및 데이터 정합성 보장.

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
