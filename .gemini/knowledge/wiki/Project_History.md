---
type: node
created: 2026-04-14
status: seedling
tags: [history, changelog]
---

# 📜 Project History (프로젝트 업데이트 이력)

IndividualSavingsFlowUI 프로젝트의 주요 변경 사항 및 기술적 진화 이력입니다.

## 🚩 주요 마일스톤 (Major Milestones)

### 🔵 2026-04-30 (v0.7.4)
- **전역 버전 정리 및 안정화**: 0.7.3과 0.7.4 간의 버전 혼선을 정리하고, Triple Sync(sw.js, manifest, app.js)를 v0.7.4로 완결.

### 🔵 2026-04-30 (v0.7.3)
- **디자인 시스템 토큰 적용**: `DESIGN.md` 기반의 디자인 토큰을 전역 테마에 반영하여 시각적 일관성 및 물리적 무결성 강화.

### 🔵 2026-04-24 (v0.7.2)
- **지능형 자동 연동 (Intelligent Sync)**: Step 2 진입 시 Step 1 데이터를 자동으로 불러오고, 수정 시에만 확인 절차를 거치는 UX 개선. 타임스탬프 파싱 버그 수정.

### 🔵 2026-04-23 (v0.7.0)
- **통합 스토리지 허브 (IsfStorageHub) 도입**: 파편화된 스토리지 로직을 IndexedDB 기반 허브로 단일화. 데이터 마이그레이션 체계 구축. Step 2 배당 시뮬레이션 특화 개편.

### 🔵 2026-04-22 (v0.6.0)
- **Step 2 고도화 및 전역 동기화 (Minor Up)**: Step 2 모듈화 완료, 고성능 배당 시뮬레이션(DGR/DRIP/인플레이션), Sankey 흐름도 탑재 및 PWA 버전 전역 동기화.

### 🔵 2026-04-21 (v0.5.12)
- **Step 2 모듈화 기반 마련**: Step 2를 7개 모듈로 분리하고 기초 시뮬레이션 엔진 구축.

### 🔵 2026-04-17 (v0.5.0)
- **Step 1 아키텍처 현대화 (The Great Refactoring)**: 4,600라인의 `apps/step1/app.js`를 11개의 전문 모듈로 분리. No-build ES6 모듈 체계 확립.

### 🟢 2026-04-16 (v0.4.0)
- **UI/UX 대개편**: 사용자 중심 적응형 레이아웃(Dashboard Mode) 및 통합 데이터 관리 허브(`DataHubModal`) 도입.

### 🟡 2026-03-24 (Step 2 MVP)
- **IndexedDB 허브 도입**: `isf-hub-db-v1` 스키마 구축 및 Step 1/2 브리지 연결 기초 마련.

---
*모든 상세 변경 이력(Audit Trail)은 [[log]] 노드에서 확인하십시오.*
