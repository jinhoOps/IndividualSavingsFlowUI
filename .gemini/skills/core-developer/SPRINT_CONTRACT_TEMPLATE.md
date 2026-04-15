---
name: sprint-contract-template
description: core-developer 스킬에서 사용하는 스프린트 계약서의 표준 템플릿입니다.
---

# 스프린트 계약서 (Sprint Contract)

## 계약 정보

| 항목 | 값 |
|---|---|
| 계약 ID | SC-YYYY-MM-DD-NNN |
| 작성일 | YYYY-MM-DD |
| 요청자 | (사용자 요구사항 요약) |
| 담당 | isf-developer |

## 목표 (Objective)

(이 스프린트에서 달성하려는 목표를 1~2문장으로 기술합니다.)

## 완료 기준 (Definition of Done)

구현이 완료되었다고 판단하기 위한 검증 가능한 기준 목록입니다.

- [ ] 기준 1: (예: "shared/storage/hub-storage.js에서 브리지 데이터를 정상적으로 읽어옴")
- [ ] 기준 2: (예: "모바일 화면(375px)에서 도넛 차트가 정상 렌더링됨")
- [ ] 기준 3: (예: "새로고침 후 sessionStorage에서 편집 중인 데이터가 복구됨")

## 영향 범위 (Impact Scope)

이 구현이 영향을 미치는 파일 및 모듈 목록입니다.

| 파일/모듈 | 변경 유형 | 회귀 위험도 |
|---|---|---|
| (예: `shared/core/utils.js`) | 수정 | 높음 - 전 앱 공통 |
| (예: `apps/step2/app.js`) | 수정 | 낮음 - Step2 한정 |

## 기술적 제약 (Constraints)

- No-build 환경 유지 (ES6 + Vanilla JS)
- shared/ 모듈 우선 재활용
- PWA 오프라인 가용성 비파괴

## 평가 요청 (Evaluation Request)

구현 완료 후 isf-evaluator에게 아래 항목의 검증을 요청합니다:

- [ ] 단위 일관성 (만원/원 변환 정확성)
- [ ] 회귀 방지 (기존 스냅샷 복원 기능 호환성)
- [ ] 데이터 무결성 (IndexedDB 스키마 정합성)
- [ ] 피드백 품질 (FeedbackManager 활용 적절성)

---
*이 템플릿은 core-developer 스킬의 "스프린트 계약" 섹션에 따라 사용됩니다.*
