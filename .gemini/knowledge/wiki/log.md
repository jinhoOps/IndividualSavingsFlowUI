# Project Evolution Log (연대기적 작업 로그)

이 파일은 프로젝트의 변화, 지식의 습득, 주요 결정을 시간 순으로 기록하는 append-only 로그입니다.

## [2026-04-16] feature | Step 2 데이터 브리지 버그 해결 및 로직 복구 (v0.4.2)
- **원인**: 
    - **단위 불일치**: Step 1(브리지)의 '원' 단위와 Step 2 UI의 '만원' 단위 격차로 인한 알림/계산 오류 발생.
    - **로직 소실**: 리팩토링 과정에서 `apps/step2/app.js` 내의 필수 헬퍼 함수(14종 이상)가 누락되어 앱 기능 마비.
- **조치**: 
    - **단위 정렬**: `IsfUtils.toWon` 및 `Math.round(... / 10000)`를 적용하여 브리지 연동 및 비교 로직의 단위 정합성 확보.
    - **로직 전면 복구**: `createEmptyDraft`, `getAccountById`, `markDirty/Clean` 등 핵심 헬퍼 함수군을 재구현하여 삽입.
    - **지식 영속화**: `Data_Model_Reference`, `Data_Bridge_Import_Pattern`, `Architecture_Reference` 위키에 해당 팩트와 패턴을 기록.
- **결과**: Step 2 포트폴리오 구성 및 브리지 알림 기능 정상화, 향후 리팩토링 시 로직 유실 방지를 위한 가이드라인 수립.

## [2026-04-16] feature | UI/UX 안정화 및 v0.4.1 릴리스
- **원인**: v0.4.0 대개편 후 발생한 레이아웃 `order` 중복 및 구식 백업 UI 요소(Ghost Listeners) 잔존.
- **조치**: 
    - **레이아웃 안정화**: `apps/step1/styles.css`에서 `order` 속성 중복을 제거하고 모바일/데스크톱 간 일관된 우선순위(`Summary -> Sankey`) 확립.
    - **코드 위생 관리**: `DataHubModal` 도입으로 불필요해진 `backupSelect`, `exportJson`, `restoreBackup` 등 구식 리스너 및 헬퍼 함수 10여 개 제거.
    - **버전 동기화**: `app.js`(Step 1/2), `sw.js`, `manifest.webmanifest` 버전을 모두 **0.4.1**로 통일하여 PWA 캐시 무결성 확보.
- **결과**: UI 파손 위험 감소 및 앱 초기 로딩/상태 관리 로직의 경량화 달성.

## [2026-04-16] ingest | 하네스 보수 및 LLM Wiki 패턴 이식
- **원인**: v0.2.4 리팩토링 중 대규모 CSS 스타일 유실 사고 발생.
- **조치**: 
    - `GEMINI.md`에 '스타일 및 반응형 무결성' Mandate 추가.
    - `core-developer` 스킬에 '물리적 파일 무결성' 수칙 도입.
    - `orchestration` 및 `isf-evaluator`에 '시각적 회귀 테스트' 검증 항목 강제.
    - `wiki-librarian` 스킬을 'LLM Wiki' 패턴(Ingest/Synthesize/Lint)으로 전면 개편.
- **결과**: 지식의 기록뿐만 아니라 코드의 물리적 보존과 지식의 복리 적립 시스템 구축.

## [2026-04-16] ingest | PWA 안정성 및 스토리지 정책 강화
- **내역**: `pwa-manager.js` 알림 통합, `hub-storage.js` 상한(20개) 정책 적용.

## [2026-04-16] feature | Sprint 2.2: UI/UX Overhaul v0.4 (사용자 중심 적응형 개편)
- **목적**: 기존 사용자의 인지 부하 감소 및 파편화된 기능 통합.
- **주요 변경사항**:
    - **적응형 대시보드**: 데이터 보유량에 따라 입력 위주에서 결과 위주(차트 상단)로 레이아웃 자동 전환.
    - **통합 데이터 허브**: 백업/공유/히스토리를 모달 하나로 통합 (`data-hub-modal.js`).
    - **저장 인디케이터**: 헤더 내 상태 표시기로 저장 성공 여부 시각화 (v0.4 신규 UI).
    - **스마트 브리지**: Step 2 진입 시 Step 1 데이터를 자동으로 인식하여 병합 제안.
- **버전**: v0.2.5 -> v0.4.0 (UI/UX 도약 및 PWA 동기화).

## [2026-04-16] feature | Sprint 2.1: HCD 개선 및 모바일 최적화 (v0.2.5)
- **목표**: 도날드 노먼의 HCD 원칙 적용 및 모바일 가독성/피드백 강화.
- **주요 변경사항**:
    - **결손 노드 시각화**: `netCashflow < 0` 시 Sankey Diagram에 '결손(부채/자산인출)' 노드 자동 생성하여 데이터 정합성(`Total In = Total Out`) 확보.
    - **모바일 Sankey 최적화**: `SANKEY_MOBILE_BASE_ZOOM`을 `0.65`로 하향 조정하고, `orientationchange` 발생 시 `viewBox` 리셋 로직 추가하여 가독성 개선.
    - **사용자 피드백 강화**: `IsfFeedback.notifyAutoSave(status)` 인터페이스 도입 및 데이터 저장 시 실시간 상태 알림 연동.
    - **디자인 시스템 정규화**: `shared/styles/step-theme.css`에 시맨틱 노드 컬러 변수(`--node-*`) 도입 및 앱 스타일 연동.
- **버전**: v0.2.4 -> v0.2.5 (PWA 동기화 완료).
- **결과**: 모바일에서의 전체 가계 흐름 파악 용이성 증대 및 데이터 불균형 시의 시각적 오류 해결.
