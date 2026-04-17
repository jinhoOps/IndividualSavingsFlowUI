# Project Evolution Log (연대기적 작업 로그)

이 파일은 프로젝트의 변화, 지식의 습득, 주요 결정을 시간 순으로 기록하는 append-only 로그입니다.

## [2026-04-17] fix | Step 1 통합 편집 UX 및 모바일 FAB 지원 패치 (v0.5.2)
- **원인**: 
    - **편집 프로토콜 불일치**: 수입 항목만 별도의 편집 모드 없이 즉시 수정 가능하여 다른 항목(지출/저축/투자)과의 UX 일관성 결여 및 의도치 않은 데이터 변경 위험 존재.
    - **초기화 크래시**: `state.js` 내 `itemEditors` 객체에 `income` 키가 누락되어 수입 항목 상호작용 시 `ReferenceError` 발생.
    - **UI 요소 누락**: 리팩토링 과정에서 각 항목별 정렬 셀렉터(`select`)가 HTML에서 누락되어 정렬 기능 상실.
    - **모바일 접근성**: 항목 편집 모드 진입 시 모바일 화면 하단에서 편집 액션을 수행할 수 있는 FAB(Floating Action Button) 연동 부족.
- **조치**: 
    - **UX 통일**: 모든 수입 항목에 "항목 편집" 버튼 및 편집 모드 프로토콜을 적용하여 `readonly` 해제 후 수정 가능하도록 통일.
    - **안정성 확보**: `state.itemEditors.income` 스키마를 추가하여 런타임 크래시 해결 및 `renderSankey` 호출 시 전역 상태의 정렬 모드를 명시적으로 전달하도록 수정.
    - **UI 복구**: 생활비/저축/투자 헤더에 누락되었던 정렬 셀렉터들을 모두 복구하고 `dom.js` 및 이벤트 리스너에 재연동.
    - **모바일 강화**: `syncMobileItemEditorFab` 및 `getActiveItemEditorGroupKey`를 구현하여 모바일 뷰(760px 이하)에서 활성화된 편집 그룹에 맞는 FAB 노출 및 액션 바인딩.
- **결과**: 앱 전반의 편집 인터페이스 일관성 확보 및 모바일 조작 편의성 증대, 초기화 단계의 치명적 오류 해결.


## [2026-04-17] ingest | Minor Up 브랜치 전략 강화 및 위키 동기화 정책 추가
- **원인**: 대규모 변경 시 메인 브랜치 무결성 보호 및 지식의 영속적 최신화 필요성 증대.
- **조치**: 
    - `GEMINI.md` 및 `orchestration` 스킬에 "Minor Up 발생 시 피처 브랜치 필수 사용" 규칙 명문화.
    - `wiki-librarian` 스킬에 "정책 변경 시 위키 노드 동기화 필수" 절차 추가.
    - `Version_Management_Principles.md` 위키 노드에 강화된 브랜치 전략 반영.

## [2026-04-17] ingest | GEMINI.md 지식 슬림화 및 위키 이관 완료
- **내역**: `GEMINI.md`의 `Gemini Added Memories` 섹션을 삭제하고 해당 지식을 `[[Version_Management_Principles]]` 노드로 일원화함.
- **효과**: "Constitutional Rules"와 "Operating Policies"의 분리를 명확히 하여 지식 중복 관리 제거.

## [2026-04-17] ingest | core-developer 스킬 폐지 및 지식 통폐합
- **원인**: `core-developer` 스킬이 `isf-developer` 에이전트 정의 및 `orchestration` 스킬과 과도하게 중복되어 컨텍스트 효율을 저해함.
- **조치**: 
    - **스킬 폐지**: `.gemini/skills/core-developer/` 디렉토리 전체 삭제.
    - **지식 이관**: '스프린트 계약(Sprint Contract)' 절차를 `orchestration/SKILL.md`로 이관하여 협업 프로세스에 통합.
    - **에이전트 강화**: '물리적 파일 무결성(절삭 방지)' 및 '단위 정합성 강제' 수칙을 `isf-developer.md` 에이전트 정의 파일에 직접 명문화.
    - **참조 정리**: `GEMINI.md`, `INDEX.md` 등 프로젝트 최상위 문서의 참조 링크 갱신.
- **결과**: 지식 구조 슬림화로 에이전트의 컨텍스트 사용 효율 증대 및 개발 사명 인식 명확화.

## [2026-04-17] fix | Step 1 모듈화 안정화 및 런타임 오류 패치 (v0.5.1)
- **원인**: 
    - **임포트 누락**: `modules/state.js`에서 `constants.js`의 `HASH_STATE_PARAM` 참조가 누락되어 URL 해시 기반 상태 복원 실패(ReferenceError).
    - **UI 렌더러 소실**: `app.js` 리팩터링 과정에서 수입/지출 리스트 렌더링 함수 4종이 유실되어 앱 초기화 중단.
    - **계산 로직 왜곡**: 수입 항목 합산 시 전역 합산 함수(`getMonthlyIncomeTotalMan`)가 아닌 일반 할당 함수를 호출하여 데이터 왜곡 발생.
- **조치**: 
    - **참조 정규화**: `state.js` 내 상수 임포트 구조를 바로잡고, 유실된 UI 렌더러 및 이벤트 바인딩 로직(`bindReadonlyAdvancedNavigation` 등)을 전면 복구.
    - **정합성 교정**: `handleItemInput/Click` 내 계산 함수를 `getMonthlyIncomeTotalMan`으로 교체하여 단위 및 카테고리별 정합성 확보.
    - **UI 복구**: `renderAllocationItemHtml`의 메타 정보(그룹/만기) 표시 로직 및 백업 저장소 준비 상태(`backupStoreReady`) 전환 로직 복구.
- **결과**: Step 1 모듈화 체제 안정화 및 기능 무결성 회복.

## [2026-04-17] feature | Step 1 Monolith 리팩터링 및 No-build 모듈화 (v0.5.0)
- **목적**: 4,600행에 달하는 `apps/step1/app.js`의 비대화를 해소하고 유지보수성 및 LLM 컨텍스트 효율을 극대화.
- **주요 변경사항**:
    - **11개 전문 모듈 분리**: `apps/step1/modules/` 디렉토리를 생성하고 책임에 따라 로직(상수, DOM, 상태, 정합성, 포맷터, 계산기, 브리지 등)을 11개의 파일로 분해.
    - **경량 컨트롤러 전환**: 기존 `app.js`를 500행 규모의 오케스트레이션 컨트롤러로 변모시키고 `type="module"` 선언.
    - **Shared 유틸리티 통합**: `debounce`, `roundTo`, IndexedDB 공통 로직을 `shared/core/utils.js`로 이관하여 중복 코드 제거.
- **결과**: `Step1_Modularization_Refactoring.md` 지식 노드 생성 및 앱 전반의 파일 가독성/응집도 획기적 향상.

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
    - **레이아웃 안정화**: `apps/step1/styles.css`에서 `order`속성 중복을 제거하고 모바일/데스크톱 간 일관된 우선순위(`Summary -> Sankey`) 확립.
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

