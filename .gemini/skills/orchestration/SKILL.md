---
name: orchestration
description: ISF 프로젝트의 에이전트 협업 프로세스를 정의합니다. 기획(Planner), 구현(Developer), 평가(Evaluator) 간의 핸드오프 순서, 입출력 규격, 워크플로우를 관장합니다.
---

# `orchestration` Skill

이 스킬은 IndividualSavingsFlowUI 프로젝트에서 기획, 구현, 평가 에이전트가 협업하는 프로세스를 정의합니다. 모든 에이전트 정의 파일(`.gemini/agents/`)에서 참조하는 "에이전트 협업 프로세스"의 원본(Single Source of Truth)입니다.

## 에이전트 역할 정의

| 에이전트 | 역할 | 모델 | 온도 |
|---|---|---|---|
| isf-planner | UI/UX 기획 및 구조 설계 | Gemini 3 | 0.7 |
| isf-developer | 기능 구현 및 리팩터링 | Gemini 3 | 0.2 |
| isf-evaluator | 품질 검증 및 회귀 테스트 | gemini-3-flash-preview | 0.1 |

## 핸드오프 워크플로우 (Hand-off Protocol)

기능 개발 시 아래의 순서를 따릅니다. 각 단계의 산출물이 다음 단계의 입력이 됩니다.

```
[사용자 요구사항]
      |
      v
[1. Planner] -- 기획 산출물 생성
      |
      v
[2. Developer] -- 구현 및 스프린트 계약 체결
      |
      v
[3. Evaluator] -- 품질 검증 및 승인/반려
      |
     / \
    v   v
 [승인]  [반려] --> Developer로 루프백 (결함 환류)
```

### 1단계: 기획 (Planner)

- 입력: 사용자 요구사항
- 산출물:
  - 기능 명세와 UX 흐름 정의
  - 데이터 브리지 페이로드 규격 (Step 간 이동 시)
  - 모바일/데스크톱 레이아웃 가이드
- 참조: `references/ui-standards.md`의 테마 시스템 및 피드백 표준

### 2단계: 구현 (Developer)

- 입력: Planner의 기획 산출물
- 산출물:
  - 구현된 코드 (shared/ 모듈 우선 재활용)
  - **스프린트 계약서 (Sprint Contract)**: 구현 전 "검증 가능한 완료 기준(DoD)"을 사용자에게 명시적으로 제안하고 합의하는 과정입니다.
- 준수 사항:
  - **계약 우선 (Contract First)**: 코드를 작성하기 전에 "이 요구사항을 구현하기 위한 테스트 및 완료 기준은 1, 2, 3 입니다"라고 먼저 선언하십시오.
  - **브랜치 전략**: Minor up이 발생하는 대규모 `feat` 또는 `refactor`는 반드시 별도의 브랜치(`feat/*`, `refactor/*`)에서 진행해야 합니다.
  - **로직 보존**: `app.js`의 3계층 구조(상태/헬퍼/UI)와 필수 헬퍼 함수(14종 이상) 유지
  - **단위 정합성**: UI(만원)와 저장/계산(원) 간 변환 시 반드시 `IsfUtils.toWon` 등 활용
  - `shared/` 디렉토리의 기존 유틸리티를 반드시 먼저 탐색
  - ES6 Native Modules 형식 유지
  - `shared/` 수정 시 모든 `apps/`에 미치는 영향 확인
- 참조: `references/architecture.md`의 디렉토리 구조 및 모듈 로드 방식

### 3단계: 검증 (Evaluator)

- 입력: Developer의 구현 코드 + 스프린트 계약서
- 산출물:
  - 검증 결과 보고 (합격/불합격)
  - 결함 목록 (불합격 시)
- 검증 항목:
  - **시각적 및 반응형 회귀 테스트 (Visual & Responsive Regression Check) - 필수!**
    - CSS 파일의 코드 양이 비정상적으로 줄어들지 않았는가?
    - 760px 이하 모바일 화면의 `@media` 쿼리 섹션이 그대로 유지되었는가?
    - 컴포넌트(Sankey, Chart 등)의 주요 클래스가 유실되지 않았는가?
  - **시스템 무결성 및 단위 일관성**:
    - 필수 헬퍼 함수 유실 여부 및 `IsfUtils` 기반의 단위(만원/원) 변환 정확성
  - **데이터 및 백업 무결성**: 
    - IndexedDB 스키마 정합성, 통합 데이터 허브(`DataHubModal`) 및 12시간 주기 백업 정상 작동 여부
  - **회귀 방지**: 기존 스냅샷 복원 기능 및 공유(`sid`, `#s`) 호환성
  - 피드백 품질 (FeedbackManager 활용 적절성)
- 참조: `references/data-model.md`의 저장 우선순위 및 백업 정책

### 루프백 규칙

- Evaluator가 불합격 판정을 내리면, 결함 목록을 Developer에게 환류(Feedback)합니다.
- Developer는 결함을 수정한 뒤 Evaluator에게 재검증을 요청합니다.
- 최대 2회 루프백 후에도 해결되지 않으면 Planner에게 기획 재검토를 요청합니다.

## 핵심 참조 문서

이 스킬과 함께 다음 참조 문서들이 프로젝트의 기술적 기반을 제공합니다:

- 아키텍처: [[Architecture_Reference]] - 디렉토리 구조 및 모듈 로드 방식
- 데이터 모델: [[Data_Model_Reference]] - 단위, IndexedDB 스키마, 저장/공유 로직
- UI 표준: [[UI_Standards_Reference]] - 테마 변수, 피드백 시스템, 시각화 가이드

## 주의 사항

- `shared/` 디렉토리의 코드를 수정할 때는 모든 `apps/` (Step1, Step2 등)에 미치는 영향을 반드시 확인해야 합니다.
- 새로운 라이브러리 추가 시 'No-build' 정책과의 호환성을 먼저 검증하십시오.
