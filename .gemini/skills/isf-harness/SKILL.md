---
name: isf-harness
description: IndividualSavingsFlowUI 프로젝트 전용 하네스 스킬입니다. No-build 아키텍처, 단계별(Step1/2) 데이터 모델, 공통 모듈(shared/) 활용법 및 UI 가이드를 포함합니다. 기획, 개발, 평가 전 단계에서 프로젝트 일관성을 유지하기 위해 사용합니다.
---

# isf-harness

'IndividualSavingsFlowUI' 프로젝트의 일관성 있는 기획, 구현 및 검증을 돕는 가이드입니다.

## 퀵 스타트 (Quick Start)

이 프로젝트는 **No-build** 환경을 지향하므로, 모든 변경 사항은 빌드 없이 브라우저에서 즉시 확인 가능해야 합니다.

### 핵심 참조 문서 (References)

- **아키텍처**: [architecture.md](references/architecture.md) - 디렉토리 구조 및 모듈 로드 방식
- **데이터 모델**: [data-model.md](references/data-model.md) - 단위(만원/원), IndexedDB 스키마, 저장/공유 로직
- **UI 표준**: [ui-standards.md](references/ui-standards.md) - 테마 변수, 피드백 시스템, 시각화 가이드

## 작업 워크플로우 (Workflows)

### 1. 기능 기획 (Planning)
- `isf-planner`는 [UI 표준](references/ui-standards.md)을 참고하여 모바일 친화적인 UX를 설계합니다.
- `data-model.md`의 단위 규약을 준수하여 데이터 흐름을 정의합니다.

### 2. 구현 및 리팩터링 (Development)
- `isf-developer`는 [아키텍처](references/architecture.md)에 따라 `shared/` 모듈을 우선적으로 재활용합니다.
- `app.js` 분리 시 네이티브 ES 모듈 형식을 유지합니다.

### 3. 품질 검증 (Evaluation)
- `isf-evaluator`는 [데이터 모델](references/data-model.md)의 저장 우선순위와 백업 정책이 정상 작동하는지 확인합니다.
- `plan-step1.md`의 체크리스트와 연동하여 회귀 테스트를 수행합니다.

## 주의 사항
- `shared/` 디렉토리의 코드를 수정할 때는 모든 `apps/` (Step1, Step2 등)에 미치는 영향을 반드시 확인해야 합니다.
- 새로운 라이브러리 추가 시 'No-build' 정책과의 호환성을 먼저 검증하십시오.
