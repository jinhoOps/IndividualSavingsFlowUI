---
name: isf-harness
description: IndividualSavingsFlowUI 프로젝트 전용 하네스 스킬입니다. No-build 아키텍처와 단계별 데이터 모델, 공용 모듈 활용법을 포함한 전문 가이드입니다.
---

# isf-harness

IndividualSavingsFlowUI 프로젝트의 일관성 있는 설계를 위한 전문 하네스입니다. 모든 작업은 아래의 기술적 제약과 전역 워크플로우 루프를 결합하여 진행합니다.

## 프로젝트 핵심 원칙

- No-build 환경: 모든 코드는 빌드 없이 브라우저에서 즉시 실행 가능한 Vanilla JS 상태를 유지합니다.
- Shared 우선 원칙: 기능 구현 전 shared/ 디렉토리의 공용 모듈 존재 여부를 반드시 먼저 탐색(Research)합니다.
- 데이터 정합성: Step1(만원)과 Step2(원) 사이의 단위 변환 및 데이터 브리지 규약을 엄격히 준수합니다.

## 전문 작업 가이드

### 1. 기능 기획 (Planning Phase)
- 리서치: references/ui-standards.md를 확인하여 모바일 가독성과 피드백 시스템 표준을 파악합니다.
- 전략 수립: data-model.md의 저장 우선순위와 브리지 페이로드 설계를 기반으로 기능 명세서를 작성합니다.

### 2. 구현 및 리팩터링 (Development Phase)
- 실행: ES6 네이티브 모듈 형식을 유지하며 apps/ 내의 비대해진 로직을 shared/ 모듈과 연계하여 분리합니다.
- 언어 준수: 모든 주석과 가이드 문구는 한국어(존댓말)와 UTF-8 형식을 유지합니다.
- 스타일 제한: GEMINI.md 지침에 따라 문서 작성 시 굵게 표시나 기울임을 사용하지 않습니다.

### 3. 품질 검증 (Evaluation Phase)
- 검증: IndexedDB(isf-hub-db)의 데이터 무결성, 12시간 주기 백업, PWA 오프라인 동작을 최종 확인(Validation)합니다.
- 회귀 테스트: 신규 기능이 기존 공유 링크 복원 및 데이터 마이그레이션 로직에 영향을 주지 않는지 평가합니다.

## 참조 문서 (References)

- 아키텍처 설계: references/architecture.md (디렉토리 구조 및 모듈 로드)
- 데이터 모델: references/data-model.md (단위, 스키마, 저장 전략)
- UI 및 피드백 표준: references/ui-standards.md (테마 변수, 시각화 가이드)

## 주의 사항
- shared/ 모듈 수정 시 모든 앱(Step1, Step2)에 미치는 파급 효과를 선제적으로 리서치해야 합니다.
- 모든 작업은 Research -> Strategy -> Execution -> Validation 단계를 자연스럽게 거치며 완료합니다.
