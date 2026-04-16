# Project Evolution Log (연대기적 작업 로그)

이 파일은 프로젝트의 변화, 지식의 습득, 주요 결정을 시간 순으로 기록하는 append-only 로그입니다.

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
