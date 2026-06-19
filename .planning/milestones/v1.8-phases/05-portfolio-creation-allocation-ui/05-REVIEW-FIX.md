---
status: all_fixed
findings_in_scope: 2
fixed: 2
skipped: 0
iteration: 1
---

# Phase 05 코드 리뷰 수정 완료 보고서 (05-REVIEW-FIX.md)

본 문서는 **Phase 05 (나만의 적립식 포트폴리오 및 자산 배분 UI)**에서 식별된 Critical 및 Warning 코드 리뷰 결함사항에 대해 조치 완료된 내역을 정리한 보고서입니다.

---

## 🛠️ 수정 조치 내역 (Fixed Findings)

### 🚨 CR-01: `IsfUtils.formatMoney` 적용으로 인한 소액 금액 왜곡 및 0원 표기 버그 조치
- **수정 파일**: [dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js)
- **조치 내용**:
  - `IsfUtils.formatMoney`를 사용하여 총 투자 금액을 만원 단위로 축약 표현 시 발생하던 1,000원 -> `0만원` 왜곡 버그를 제거하였습니다.
  - 목록 카드의 총액 표시부, 모달 창의 총액 표시부, 모달 내 개별 자산 리스트, 1년 누적 투자 추이 예시 그래프의 금액 표기 등 모든 화면 렌더러에 대해 천 단위 구분자가 들어간 원 단위 표현(`toLocaleString('ko-KR') + '원'`)으로 리팩토링하였습니다.
  - `IsfUtils.convertToKoreanWon` 한글 변환 힌트를 병행 제공하여 가독성을 높였습니다.
- **커밋**: `fix(05): resolve CR-01 format money bug and WR-01 input validation warning` (`f3814bb`)

### ⚠️ WR-01: 금액 입력 유효성 불통과 시 시각적 경고/에러 피드백 장치 누락 조치
- **수정 파일**: [dom.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step3/modules/dom.js)
- **조치 내용**:
  - `05-UAT.md` 6번 유효성 검사 경고 표시 기준에 맞춰, 포트폴리오 에디터 폼에서 자산 금액 입력 시 실시간 유효성을 판별하도록 하였습니다.
  - 금액이 유효하지 않을 경우(최소 1,000원 미만 또는 1,000원 단위가 아닐 때), 금액 입력창 하단 테두리를 붉은 보더(`border-bottom-color: var(--status-error, #ff5e5e)`)로 시각적 경고 피드백을 주었습니다.
  - 또한, 실시간 금액 힌트 영역에 `⚠️ 1,000원 단위로 입력해 주세요 (최소 1,000원)`라는 에러 가이드를 실시간 렌더링하도록 UI를 보완하였습니다.
- **커밋**: `fix(05): resolve CR-01 format money bug and WR-01 input validation warning` (`f3814bb`)

---

## 🔍 검증 결과 요약
- **정적 타입 및 빌드 검증**: `npm run check` (tsc --noEmit) 실행 결과 오류 없이 정상 통과되었습니다.
- **단위 정합성 준수**: 소액 포트폴리오 생성 및 비중 입력 시 모든 금액이 1,000원 등 정확한 '원' 단위로 정상 렌더링되고 경고가 정상 표현됨을 대조 확인했습니다.
- **물리적 무결성**: 파일 하단의 CSS 및 HTML 절삭 현상 없이 정상적으로 머지되었습니다.
