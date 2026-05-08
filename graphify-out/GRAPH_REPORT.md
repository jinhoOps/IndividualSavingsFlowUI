# Graph Report - IndividualSavingsFlowUI  (2026-05-08)

## Corpus Check
- 91 files · ~48,681 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 696 nodes · 1176 edges · 46 communities (42 shown, 4 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `da28496e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]

## God Nodes (most connected - your core abstractions)
1. `Project Evolution Log (연대기적 작업 로그)` - 62 edges
2. `sanitizeInputs()` - 24 edges
3. `init()` - 21 edges
4. `PwaManager` - 18 edges
5. `🕒 주요 마일스톤` - 17 edges
6. `DataHubModal` - 15 edges
7. `IsfState` - 14 edges
8. `renderAll()` - 13 edges
9. `renderSankey()` - 13 edges
10. `IsfStore` - 13 edges

## Surprising Connections (you probably didn't know these)
- `init()` --calls--> `initOnboarding()`  [INFERRED]
  apps/step1/app.js → apps/step1/modules/onboarding-manager.js
- `handleApplyIsfCode()` --calls--> `sanitizeInputs()`  [INFERRED]
  apps/step1/app.js → apps/step1/modules/input-sanitizer.js
- `renderAll()` --calls--> `simulateProjection()`  [INFERRED]
  apps/step1/app.js → apps/step1/modules/calculator.js
- `renderAll()` --calls--> `buildSummaryCards()`  [INFERRED]
  apps/step1/app.js → apps/step1/modules/calculator.js
- `renderAll()` --calls--> `renderSankey()`  [INFERRED]
  apps/step1/app.js → apps/step1/modules/sankey-renderer.js

## Communities (46 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (86): buildMonthlySnapshot(), calculateComparison(), compareItems(), formatBackupTimestamp(), createAllocationItemId(), getMonthlyIncomeTotalWon(), applyPreset(), distributeAmount() (+78 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (62): [2026-04-16] feature | Sprint 2.1: HCD 개선 및 모바일 최적화 (v0.2.5), [2026-04-16] feature | Sprint 2.2: UI/UX Overhaul v0.4 (사용자 중심 적응형 개편), [2026-04-16] feature | Step 2 데이터 브리지 버그 해결 및 로직 복구 (v0.4.2), [2026-04-16] feature | UI/UX 안정화 및 v0.4.1 릴리스, [2026-04-16] ingest | 하네스 보수 및 LLM Wiki 패턴 이식, [2026-04-16] ingest | PWA 안정성 및 스토리지 정책 강화, [2026-04-17] feature | Step 1 Monolith 리팩터링 및 No-build 모듈화 (v0.5.0), [2026-04-17] fix | Step 1 헤더 버튼 복구 및 UI 정리 (v0.5.3) (+54 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (39): allocateByWeights(), buildInvestBuckets(), buildProjectionRecord(), buildSavingsBuckets(), simulateProjection(), buildAllocationMetaText(), cloneInputs(), createIncomeId() (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (35): calculateCAGR(), calculateDividendProjection(), formatCurrency(), formatDateTime(), getTotalMonthlyInvestCapacity(), initDom(), drawSimulationChart(), initGlobalTooltips() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (7): AppHeader, notifyAutoSave(), showFeedback(), compareSemver(), parseSemver(), BackupService, IsfStore

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (24): buildSummaryCards(), renderComparisonChart(), renderComparisonSummary(), formatCurrency(), formatMonthSpan(), formatPercent(), formatSankeyDisplayValue(), formatSignedCurrency() (+16 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (4): IsfState, getDb(), isIdbSupported(), perform()

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (22): Agent Prompt Guide, Brand & Accent, Breakpoints & Adaptability, code:yaml (context: "ISF UI Development"), Collapsing Strategy, Colors, Components, Depth & Elevation (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.19
Nodes (3): isStandaloneDisplayMode(), PwaManager, shouldUseServiceWorker()

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (18): 🕒 주요 마일스톤, [2026-04-14] UI/UX Overhaul (v0.3.0), [2026-04-16] Step 1 Modularization (v0.5.0), [2026-04-17] Storage Hub Integration, [2026-04-18] Step 2 Modularization (v0.7.0), [2026-04-20] System Integrity Recovery, [2026-05-04] Modernization Pivot (v1.1.0-alpha.1), [2026-05-04] Phase 4: KPI Dashboard (v0.7.15) (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (12): buildShareLink(), buildStateEnvelope(), decodeBase64Url(), decodePayloadFromHash(), encodeBase64Url(), encodePayloadForHash(), lzCompress(), lzCompressToUriComponent() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (3): BacktestEngine, SimulationWarning(), Toast()

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (14): 1. 디자인 시스템 감사 및 수정 목록 (Audit & Fix), 2. Step 3: 포트폴리오 에디터 및 리밸런싱 가이드 기획, 3. Onboarding UX 전략: '처음 접속 시 가이드', 4. 파일 구조 설계 (Step 3), 5. 실행 로드맵, A. 개념적 모델 (Conceptual Model), A. Glassmorphism 강화 (Surface & Depth), A. 시각적 유도 (Signifiers) (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.35
Nodes (13): buildBackupSignature(), createBackupEntry(), createBackupEntryId(), getBackupDb(), getBackupTimestampMs(), idbRequestToPromise(), idbTransactionDone(), isIndexedDbAvailable() (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (11): 테마 시스템, 시각화, 타이포그래피, CSS 구조 및 무결성 (CSS Structure & Integrity) - 중요!, Dividend Simulation Chart (Step 2), Donut Chart (Step 3 예정), 레이아웃 패널 순서 (Panel Ordering), Sankey Diagram (Step1) (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (11): 주요 기능, 1. 배경 및 목적, 2. 핵심 아키텍처: `IsfStorageHub`, 4.1 LocalStorage 마이그레이션, 4.2 백업 이력 마이그레이션 (IndexedDB), 4.3 실행 시점, 4. 데이터 마이그레이션 (v0.7.1 추가), 5. 뷰 모드 안전 저장 프로토콜 (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (10): 저장소 관리 규칙, 데이터 브리지 (Bridge Strategy), code:typescript (// 예시), code:typescript (export interface Step1State {), 금액 단위 (Currency Units), Data Model Reference (데이터 모델 참조), IndexedDB 스키마 (`isf-v2-db`), 저장 레이어 (IsfStore v2) (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.2
Nodes (9): 구조, 문제 정의, 배포 페이지에서 바로 사용, 현재 기능, 저장 방식, 로컬 개발 및 실행, code:bash (# 저장소 복제), IndividualSavings Flow UIUX (v0.9.x) (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (9): 1-1. 전역 상태 및 입력 인터페이스, 1-2. 시각화 (Sankey Diagram), 1-3. 계산 로직: 가계 추이 검증 (Projection), 1. Step 1: 나의 가계 흐름 (apps/step1), 2-1. 브리지(Bridge) 기능, 2-2. 포트폴리오 구성 및 UI 인터랙션, 2-3. 배당 시뮬레이션 추이 (Dividend Simulation), 2. Step 2: 투자 포트폴리오 (apps/step2) (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): 배경 및 원인, 리팩터링 전략, 1. 모듈 디렉토리 구성 (`apps/step1/modules/`), 2. 경량 컨트롤러 (`apps/step1/app.js`), 결론 및 교훈, 3. Shared 유틸리티 통합, [ARCHIVED] Step1 Modularization Refactoring (Step 1 모듈화 리팩터링), ⚠️ 리팩터링 후 주의사항 (Post-refactoring Pitfalls)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): ARCHIVE, code:block1 ({"kanban-plugin":"basic"}), In Progress (v0.9.12), Next High Priority, Pending / Not Started, RECENT HISTORY (v0.8.7~v0.8.8), TODO (v0.9.8)

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (7): 디렉토리 구조, 모듈 및 빌드 관리, Architecture Reference (아키텍처 참조), 데이터 흐름 (Data Flow), 핵심 철학: 시스템 무결성 (Integrity First), 스토리지 아키텍처 (Modern Storage v2), 기술 스택 (Tech Stack)

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (7): ⚖️ 대한민국 금융소득종합과세 정책 (요약), 1. 금융소득종합과세 주의 (`warn`), 종합소득 누진세율 (2023년 귀속분 기준), 2. 치명적 경고 (`crit`), 🛠️ 구현 가이드, Financial Taxation Reference (금융소득 및 과세 정책 참조), 🚨 프로젝트 UI 경고 정책 (Safety Margin)

### Community 25 - "Community 25"
Cohesion: 0.25
Nodes (7): 지식 관리 구조, 위키 노드 작성 규칙, 담당 스킬, code:block1 ([개발/리팩터링 작업 완료]), code:yaml (---), 지식 하네스 운영 체계 (Knowledge Harness: LLM Wiki), 지식 생성 라이프사이클 (The Compounding Loop)

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (7): 배경 및 원인, 1. 배당 시뮬레이션 대시보드 집중, 2. 아키텍처 슬림화 (Logic Decoupling), ⚠️ 주의사항 및 교훈, 리팩터링 전략: 7개 전문 모듈 최적화 (`apps/step2/modules/`), [ARCHIVED] Step2 Modularization Refactoring (Step 2 배당 시뮬레이션 특화 개편), 주요 기술 혁신 (v0.7.0 업데이트)

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (5): 🚨 핵심 가드레일 (Critical Guardrails), Individual Savings Flow UI (ISF) - Agent Router, 📌 필수 작업 프로토콜 (Mandatory Protocols), 🛠️ 실무 참조 (Reference Manuals), 🧭 역할 기반 라우팅 (Routing)

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (5): 🚀 활성 지식 (Active Knowledge), 🗄️ 아카이브 (Archive), 🗺️ Project Knowledge Index (LLM Wiki), 🏛️ 핵심 참조 (The Constitution), 📜 연대기 및 로그 (Timeline & Logs)

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (5): 🚀 개발 및 커밋 원칙, ⚖️ 핵심 헌법 (Core Pillars), 📝 Operating Principles (프로젝트 운영 원칙), 🛠️ 기술 및 PWA 동기화 (Automated Sync), 🏛️ 지식 베이스 운영 (The Librarian Workflow)

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (5): 1) 개발 배경, 2) 주요 기능 범위 (MVP), 3) 기술적 고려 사항, 4) 마일스톤 (예정), 🗺️ Step3: 포트폴리오 구성 및 최적화 개발 계획 (Roadmap)

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (5): 1. 스타일 및 반응형 무결성, 2. 로직 보존 (Core Logic Protection), 3. 단위 정합성 (Unit Consistency), 4. No-build 지향 (Modern Hybrid), 🚨 System Integrity Standard (시스템 무결성 표준)

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (5): 1. 버전 번호 체계 (SemVer), 2. SSOT 버전 관리 (Single Source of Truth), 3. Triple Sync 자동화 (Vite Build), 4. 버전 업데이트 워크플로우, 📌 Version Management Principles (버전 관리 원칙)

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (5): 통합 앱 간 데이터 브리지 및 자동 연동 패턴, 개요, 연관 지식, 핵심 문제 및 원인 (AS-IS), 자동 연동 및 수정 가드 원칙 (TO-BE, v0.7.4)

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (5): 1) 현재 상태 요약, 2) 핵심 기술 부채 및 개선 과제, 3) 안정화 체크리스트, 4) 우선순위 및 실행 전략, [ARCHIVED] 🗺️ Step1: 나의 가계 흐름 개발 계획 (Roadmap)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (5): 🏛️ 개편 배경 및 목적, 🛠️ 주요 기술 변경 사항, 🔗 관련 링크, [ARCHIVED] UI/UX 통합 개편 및 v0.3 격상 (HCD 원칙 적용), 📐 적용된 HCD 6대 원칙

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (5): 1. 스마트 적응형 엔트리 (Smart Adaptive Entry), 2. 데이터 관리 허브 통합 (Consolidated Data Hub), 3. 저밀도 피드백 시스템 (Silent Status Indicator), 4. 스마트 브리지 배너 (Smart Bridge Banner), [ARCHIVED] UI/UX Overhaul v0.4 (사용자 중심 적응형 개편)

### Community 37 - "Community 37"
Cohesion: 0.4
Nodes (4): 📥 지식 인입 (Ingest Scan), ✅ 무결성 검증 (Lint), 📁 지식 저장소 위치 변경 (Migration), Wiki Ingestion & Migration Report (2026-05-07)

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (3): 1. 행동 강령 (Guardrails), 🛠️ Agent Behavior Standard (에이전트 행동 지침), code:block1 (1. [Step] → verify: [check])

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (3): 1) 변경된 상태 요약, 2) Step 2 최종 MVP 범위 (v0.7.0+), [DEPRECATED] 🗺️ Step2: 포트폴리오 구성 개발 계획 (Roadmap)

### Community 40 - "Community 40"
Cohesion: 0.5
Nodes (3): shared, storage/hub-storage.js, styles/step-theme.css

## Knowledge Gaps
- **214 isolated node(s):** `Overview (Visual Theme & Atmosphere)`, `Brand & Accent`, `Surface & Background`, `Font Family`, `Hierarchy` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DataHubModal` connect `Community 11` to `Community 4`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `PwaManager` connect `Community 8` to `Community 4`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `getHubStorage()` connect `Community 3` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `sanitizeInputs()` (e.g. with `handleApplyIsfCode()` and `commitImmediateInputs()`) actually correct?**
  _`sanitizeInputs()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Overview (Visual Theme & Atmosphere)`, `Brand & Accent`, `Surface & Background` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._