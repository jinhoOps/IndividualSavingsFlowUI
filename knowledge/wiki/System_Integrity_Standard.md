---
type: node
created: 2026-05-07
status: evergreen
tags: [standards, integrity, data, uiux]
---

# 🚨 System Integrity Standard (시스템 무결성 표준)

이 문서는 IndividualSavingsFlowUI 프로젝트의 핵심 무결성 규칙을 정의합니다. 모든 에이전트는 코드 수정 시 이 표준을 준수해야 합니다.

## 1. 스타일 및 반응형 무결성
- **물리적 무결성**: CSS/HTML 수정 시 파일 하단의 `@media` 쿼리나 유틸리티 클래스가 절삭(Truncate)되지 않도록 수정 전후의 파일 크기와 구조를 반드시 대조하십시오.
- **반응형 우선**: 760px 이하 모바일 레이아웃이 파손되지 않았는지 Evaluator 단계에서 시각적으로 재검증해야 합니다.
- **명명 규칙 (BEM/Snake)**: CSS 클래스는 BEM 표기법(`block__element--modifier`) 또는 단어 간 하이픈/언더스코어를 사용하는 스네이크 스타일을 일관되게 적용하여 스타일 통일성을 유지하십시오.

## 2. 로직 보존 (Core Logic Protection)
- 리팩토링 시 `app.js`의 **3계층 구조(상태/헬퍼/UI)**를 유지하고, `markDirty` 등 14종 이상의 필수 헬퍼 함수가 소실되지 않도록 주의하십시오.

## 3. 단위 정합성 (Unit Consistency)
- **UI(만원) vs 저장/계산(원)** 규칙을 수호하십시오. 
- 모든 사용자 입력 및 UI 표시는 **만원** 단위로 통일하십시오.
- 모든 내부 계산 및 영속화 데이터는 **원** 단위를 유지하십시오.
- **억원 단위 표기**: 1억 원(10,000 만원) 이상일 경우 `X 억 Y 만원` 형태로 표기하여 가독성을 높이십시오.
- **금융종합소득과세 경고**: 연간 이자/배당 소득이 **1,900만 원** 초과 시 `warn`, **3,400만 원** 초과 시 `crit` 경고를 UI에 표시하십시오.
- 변환 시 `IsfUtils.toWon`, `IsfUtils.toMan`, `IsfUtils.formatMoney`를 적극 활용하여 단위 오차를 방지하십시오.

## 4. No-build 지향 (Modern Hybrid)
- 순수 CSS/JS의 간결함을 지향하되, 대규모 리팩터링 및 타입 안정성을 위해 Vite/TS/Tailwind 인프라를 수용합니다.
- 향후 복잡한 UI 대시보드 및 상태 관리를 위해 **React**를 점진적으로 도입할 계획이며, 이를 위한 기본 의존성을 확보하고 있습니다.
- 단, 레거시 모듈의 즉각적인 브라우저 실행 가용성을 최대한 존중하십시오.

---
*연결 노드:* [[Operating_Principles]], [[Architecture_Reference]]
