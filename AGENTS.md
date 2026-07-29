# Agent Guide

이 문서는 작업자가 역할에 맞는 기준 문서를 빠르게 찾기 위한 저장소 이정표다. 제품 요구사항이나 구현 세부사항을 여기 복제하지 말고 연결된 원문을 따른다.

## Start Here

1. 이 문서에서 자신의 역할과 작업 범위를 확인한다.
2. [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)의 관련 범위를 읽는다.
3. 아래 Role Routing에 지정된 문서만 추가로 읽는다.
4. 작업 전에 `git status --short`로 사용자와 다른 작업자의 변경을 확인한다.
5. 범위를 벗어난 인접 리팩터링 없이 맡은 작업을 수행한다.
6. 변경 표면에 해당하는 검증을 실행하고 결과와 위험을 인계한다.

`.planning` 전체, 과거 milestone 전체, 저장소 전체를 선행 탐색할 필요는 없다. 먼저 `rg`와 `rg --files`로 필요한 범위를 좁힌다.

## Minimum Rules

- Main은 완료된 현재 제품 기준선이다.
- Main의 일반 재무 편집 경로는 Financial Detail Modal이다.
- Simulation, Portfolio, Account Map은 각각 독립적인 편집·저장 상태를 소유한다.
- Account Map은 Main 데이터를 읽을 수 있지만 Main에 암묵적으로 write-back하지 않는다.
- 레거시 코드는 기능과 데이터 계약 이관을 위한 임시자산이며 지원 제품 경로나 신규 기능 기반이 아니다.
- 레거시 제거 전 동작과 데이터 계약을 목록화하고, 이관 또는 명시적 폐기 근거·호환성 검증·참조 제거·회귀 검증을 완료한다.
- 사용자 변경과 다른 작업자의 관련 없는 변경을 보존한다.
- 제품 경계를 바꾸면 코드만 고치지 말고 PRD, 승인된 spec 또는 ADR도 갱신한다.
- 최신 검증 증거 없이 완료를 주장하지 않는다.

문서 소유권:

- 제품 범위·요구사항·인수 조건: [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- 제품 소개·실행 명령: [README](README.md)
- UI·반응형·접근성 계약: [DESIGN](DESIGN.md)
- 구현 구조·관례: [Codebase Maps](.planning/codebase/)
- 전달 순서·현재 위치: [Roadmap](.planning/ROADMAP.md), [State](.planning/STATE.md)
- 주요 아키텍처 결정: [ADRs](docs/adr/)
- 기능 설계·실행 기록: [Superpowers Specs](docs/superpowers/specs/), [Superpowers Plans](docs/superpowers/plans/)

## Role Routing

| 역할 | 추가로 읽을 문서 | 핵심 책임 |
| --- | --- | --- |
| Coordinator | [Roadmap](.planning/ROADMAP.md), [State](.planning/STATE.md), 활성 spec·plan | 겹치지 않는 작업 분리, 공유 초기화의 단일 소유자 지정, 검증과 위험 취합 |
| Planner / Product | [Requirements](.planning/REQUIREMENTS.md), [Roadmap](.planning/ROADMAP.md), 관련 spec | 현재 제품·마이그레이션·향후 범위를 구분하고 요구사항과 인수 조건 정의 |
| UX / Design | [DESIGN](DESIGN.md), 관련 spec, 관련 브라우저 테스트 | summary-first와 Financial Detail 경계 유지, 390px·768px·desktop 및 접근성 검증 |
| Architecture / Development | [Architecture](.planning/codebase/ARCHITECTURE.md), [Structure](.planning/codebase/STRUCTURE.md), [Conventions](.planning/codebase/CONVENTIONS.md), 관련 ADR·spec·plan | 현재 모듈과 데이터 소유권 안에서 구현하고 외부 동작 테스트 갱신 |
| Storage / Legacy Migration | PRD의 Migration Transition, [Integrations](.planning/codebase/INTEGRATIONS.md), [Concerns](.planning/codebase/CONCERNS.md), 관련 호환성 코드 | 기능·schema 의미를 먼저 목록화하고 저장·import·export·backup·share 호환성과 참조 제거 입증 |
| QA / Review | PRD 인수 조건, [Testing](.planning/codebase/TESTING.md), 관련 spec·plan, 현재 diff | 요구사항, 회귀, 모바일, 저장 호환성, 보안을 사용자 관찰 동작 기준으로 검토 |
| Documentation | [README](README.md), [DESIGN](DESIGN.md), [Roadmap](.planning/ROADMAP.md), 관련 ADR·spec | 원문을 중복하지 않고 현재·전환·향후 상태와 링크·용어·상태 주장을 일치시킴 |

한 작업자가 여러 역할을 맡으면 목록을 합치고 중복 문서는 한 번만 읽는다. 과거 milestone은 특정 계약의 역사 확인이 필요할 때만 연다.

## CodeGraph

저장소에는 이미 `.codegraph/`가 있다. 이를 재사용하며 일반 작업자는 CodeGraph `init`, 재초기화, rebuild 또는 삭제를 실행하지 않는다. 일반적인 탐색은 `rg`, `rg --files`, 역할별 문서를 우선 사용하고 CodeGraph 초기화를 완료 조건으로 삼지 않는다.

`.codegraph/`가 없거나 실제로 사용할 수 없고, 작업에 그래프 인덱스가 실질적으로 필요하며 일반 탐색으로 부족할 때만 Coordinator 또는 명시적으로 지정된 graph owner 한 명이 초기화나 rebuild를 수행할 수 있다. 다른 작업자는 임의로 복구하지 말고 Coordinator에게 알린다.

## Verification

| 변경 표면 | 필수 검증 |
| --- | --- |
| 문서만 변경 | 상대 링크 확인, `git diff --check`, PRD·Roadmap 상태 주장 대조 |
| TypeScript 또는 공유 계약 | `npm run check`, 영향 소비자의 focused test |
| 사용자 흐름 | 관련 Playwright spec 또는 focused group; 여러 앱이나 공유 인프라 영향 시 전체 E2E |
| UI | 390px, 768px, desktop에서 overflow·modal containment·focus·touch target·graph visibility |
| 레거시 제거 | runtime import·route·selector·storage key·compatibility path·test reference 검색, 구데이터 호환성, 타입 검사와 관련 전체 회귀 |

검증이 실패하면 원인을 해결하거나 미해결 상태와 재현 명령을 인계한다. 실패를 성공처럼 요약하지 않는다.

## Conflicts and Handoff

문서가 충돌하면 다음 우선순위를 따른다.

1. 현재 사용자 지시
2. Product PRD
3. 현재 승인된 Superpowers spec
4. 폐기되지 않은 ADR
5. 활성 Roadmap과 Requirements
6. Codebase Maps
7. 과거 milestone 문서

작업 범위가 PRD와 충돌하면 멈추고 차이를 보고한다. 다른 작업자가 같은 파일을 소유하면 덮어쓰지 말고 조율한다.

완료 인계에는 다음을 포함한다.

- 변경 파일과 목적
- 실행한 검증 명령과 결과
- 남은 위험 또는 미해결 항목
- 후속 작업이 있으면 다음 소유자와 시작 문서

## Canonical Documents

- [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- [README](README.md)
- [DESIGN](DESIGN.md)
- [Active Roadmap](.planning/ROADMAP.md)
- [Project State](.planning/STATE.md)
- [Active Requirements](.planning/REQUIREMENTS.md)
- [Codebase Maps](.planning/codebase/)
- [ADRs](docs/adr/)
- [Superpowers Specs](docs/superpowers/specs/)
- [Superpowers Plans](docs/superpowers/plans/)
