---
kanban-plugin: basic
---

# TODO (v1.1.0-alpha.1)

## Done (v1.1.0-alpha.1)
- [x] **Phase 5: Step 1 Spotlight 온보딩 가이드**
  - [x] Step 1 첫 접속 시 프리셋 선택 영역 강조 Spotlight 가이드 구현
  - [x] 단계별 흐름 안내 및 localStorage 상태 저장
- [ ] **Step 3: 포트폴리오 시각화 및 구성 (준비 중)**
  - [ ] Step 1의 투자 여력 데이터를 기반으로 계좌/종목 비중 구성 및 시각화(도넛, Sankey) 구현
  - [ ] 목표 비중(Target) vs 실제 보유(Actual) 격차 분석 및 리밸런싱 가이드 통합

## Done (v0.7.15 Patch)
- [x] **Triple Sync 완결 (v0.7.15)**: `sw.js`, `manifest.webmanifest`, `app.js` 버전 동기화 및 PWA 캐시 갱신.
- [x] **Phase 4: KPI 대시보드 카드 및 테이블 정리**:
  - [x] 시뮬레이션 결과 요약 KPI 카드(최종 자산, 배당금, 수익률) 구현
  - [x] 테이블 헤더 (만원) 표기 제거 및 레이아웃 정제
  - [x] DESIGN.md Glassmorphism 스타일 적용 및 모바일 대응
- [x] **Phase 3: 시뮬레이션 차트 시각화 고도화**:
  - [x] 인터랙티브 툴팁 및 SVG 반응형 개선
  - [x] PR/TR 복리 효과 가시화 (Polygon 영역)
  - [x] 배당 시뮬레이션 프리셋 3종 추가

## Done (v0.7.13 Patch)
- [x] **시뮬레이션 UI 고도화**: `simTable` 헤더 툴팁을 JS 기반 전역 핸들러로 전환하여 `overflow` 문제를 해결하고 즉각적인 반응성 확보.
- [x] **시뮬레이션 UI 고도화**: 차트 툴팁을 '배당 재투자' 설정값에 따라 PR/TR 중 해당하는 정보만 노출하도록 롤백 및 최적화.

## Done (v0.7.11 Patch)
- [x] **시뮬레이션 UI 고도화**: 브라우저 기본 툴팁 대신 즉시 나타나는 커스텀 CSS 툴팁(`data-tooltip`) 시스템 도입 및 `simTable` 헤더 적용.
- [x] **시뮬레이션 UI 고도화**: 차트 툴팁에 PR(미투자)와 TR(재투자) 수치를 함께 표시하여 시각적 비교 기능 강화.

## Done (v0.7.10 Patch)
- [x] **시뮬레이션 UI 고도화**: 차트 툴팁에 PR(미투자)와 TR(재투자) 수치를 함께 표시하여 시각적 비교 기능 강화.
- [x] **시뮬레이션 UI 고도화**: PR/TR 시각화 설명 툴팁 보완 및 시뮬레이션 결과 테이블 헤더 텍스트 간소화.

## Done (v0.7.9 Patch)
- [x] **시뮬레이션 UI 고도화**: 프리셋 버튼 2-Depth (카테고리 -> 비율) 구성 개편 및 가중 평균 자동 계산 로직 적용.
- [x] **시뮬레이션 UI 고도화**: PR/TR 시각화 설명 툴팁 보완 및 시뮬레이션 결과 테이블 헤더 텍스트 간소화.
- [x] **렌더러(툴팁) 안정성 강화**: SVG 영역 이탈 방지 좌표 계산 추가 (`apps/step2/modules/renderers.js`).
- [x] **앱 마이그레이션 방어 로직 추가**: `backup-manager.js`의 AppKey 마이그레이션 간 IDB ObjectStore 인덱스 방어 코드 작성 및 버전 상향.

## Done (v0.7.8 Patch)
- [x] **Phase 2: 템플릿 세부 항목 수동 조절 기능**: 프리셋 로드 후 세부 항목 편집 UX 및 로직 강화.
- [x] **항목 편집기 고도화**: 변경 감지 서명(Signature) 확장 및 동적 적용 버튼 제어 구현.
- [x] **Triple Sync 완결 (v0.7.7)**: `sw.js`, `manifest.webmanifest`, `app.js` 버전 동기화 완료.

## Done (v0.7.6 Patch)
- [x] **Phase 1: 프리셋 템플릿 로드 및 자동 시각화**: 연봉 및 투자 성향별 표준 가계 흐름 로드 기능 구현 완료.
- [x] **디자인 시스템 고도화 (Typography)**: `Black Han Sans` 및 `Gowun Dodum` 폰트 적용 및 시각적 일관성 확보.
- [x] **Triple Sync 완결 (v0.7.5)**: `sw.js`, `manifest.webmanifest`, `app.js`(S1/S2) 버전 동기화 완료.
- [x] **Wiki Hygiene**: 지식 베이스 링크 정합성 및 인덱스 현행화 완료.

## Done (v0.7.4 Patch)
- [x] **디자인 시스템 고도화 (Glassmorphism)**: `DESIGN.md` 원칙에 따라 전역 테마 변수 및 유리 질감 효과 적용 완료.
- [x] **Typography 정합성 확보**: 주요 수치 및 헤더에 `Black Han Sans` 적용 완료.
- [x] **Triple Sync 완결 (v0.7.4)**: `sw.js`, `manifest.webmanifest`, `app.js` 및 모든 모듈의 버전 정보 동기화.
- [ ] **데이터 관리 경험 개선**
  - [ ] 저장된 포트폴리오 목록 다중 선택 및 일괄 삭제 기능 추가
  - [ ] 포트폴리오별 '버전 태그' 또는 '히스토리 메모' 기능 (기존 메모 필드 확장)
- [ ] **시각화 가독성 개선 (HCD)**
  - [ ] 현금 흐름 Sankey 다이어그램: 모바일 가로모드 최적화 및 확대/축소(Zoom/Pan) 기능 도입

## 보류 및 검토 (Low Priority)
- [ ] 목돈 예적금(적립식/파킹통장) 특화 입력 체계 (기본 금액 체계로 수동 관리 권장 중)
- [ ] 항목별 텍스트 색상 커스텀 (현재는 테마 기반 자동 지정 유지)

## Done (v0.7.2 Patch)
- [x] **v0.7.2 패치 버전 관리**: `sw.js`, `manifest.webmanifest`, `apps/step1/app.js` 등 누락된 버전 정보 동기화 및 전역 정합성 확보.

## Done (v0.7.1)
- [x] **공유 데이터 및 백업 정합성 보완**: Step 1/2 간의 공유 ID 및 백업 저장 로직 안정화.

## Done (v0.7.0)
- [x] **스토리지 허브 통합 및 데이터 연동 최적화 (2026-04-23)**: `IsfStorageHub`를 통한 로컬/IDB 관리 단일화 및 Step 1 -> Step 2 직접 데이터 연동 구현 완료.
- [x] **Step 2 배당 시뮬레이션 특화 개편 (2026-04-23)**: 포트폴리오 구성 기능을 제거하고 순수 시뮬레이션 전용 페이지로 전환.
- [x] **Step 2 UI/UX 간소화**: 도넛 차트, 생키, 계좌 에디터 제거 및 시뮬레이션 대시보드 중심 배치.

## Done (v0.6.0 Release 완료)
- [x] **Step 2 고성능 배당 엔진 탑재 (2026-04-22)**: DGR, DRIP, 인플레이션이 반영된 정교한 시뮬레이션 구현 완료.
- [x] **Step 2 산키(Sankey) 흐름도 통합 (2026-04-22)**: 월 투자 여력에서 계좌/종목으로 이어지는 시각화 완료.
- [x] **Step 2 모듈화 리팩터링 완료 (2026-04-21)**: `apps/step2/app.js`를 7개 전문 모듈로 분리 완료.
- [x] **전역 버전 동기화 (Quad Sync)**: sw.js, manifest, app.js(S1/S2) 버전을 0.6.0으로 일치시킴.
- [x] **시스템 무결성 및 단위 정합성 수호**: `IsfUtils` 기반의 단위 변환 및 헬퍼 함수 보존 완료.
- [x] **Step 1 Monolith 리팩터링**: 4,600라인 `app.js`를 11개 모듈로 분해 및 최적화 (v0.5.0)

## Bug
- [x] Step 2 새로고침 시 데이터 소실 현상 (정규화 로직 보완으로 해결)
- [x] 모바일 차트/그래프 미노출 (SVG ViewBox 및 최소 높이 확보 완료)
- [x] 헤더 버튼 작동 보장 - 톱니바퀴 미동작
- [x] 톱니바퀴 - 백업/복원 기능 미동작 (IsfStorageHub 연동으로 해결)

%% kanban:settings
```
{"kanban-plugin":"basic"}
```
%%

