# 2026-09-11 공통 금액 조정·선택 컨트롤 정리

사용자가 앞선 버튼 검토의 스타일 개선과 Simulation 계산 기준의 증감 단위 변경을 승인했다. 기존 UX와 데이터 소유권을 유지하며 공통 표현을 정리했다. 로컬 작업 기록이며 운영 배포 기록이 아니다.

## 스타일

- [MoneyAdjustments](../../../src/components/common/MoneyAdjustments.tsx): 얇은 경계와 옅은 배경 안에 금액 증감을 같은 크기로 묶는다. 감소는 중립색, 증가는 청록색이며 클릭 후 선택 상태를 남기지 않는다. hover·pressed·keyboard focus는 구분한다.
- [SegmentedControl](../../../src/components/common/SegmentedControl.tsx): 월/연과 명목/실질의 현재 선택을 흰 면·청록 글자·얇은 경계로 표시한다. 기존 버튼·`aria-pressed`와 Tab/Enter/Space 동작을 유지한다.
- 두 컨트롤은 [app-foundation.css](../../../src/styles/app-foundation.css)에서 44px 최소 조작 크기, 14px 글자, 간격과 반응을 공유한다. 누를 때 크기나 위치를 움직이지 않으며 reduced-motion에서는 transition을 생략한다.
- Main 직접 금액 편집·빠른 설정·지출 도우미, 공통 원화 입력, Simulation 시작 자산·계산 기준의 반복 markup과 국소 스타일을 공통 컴포넌트로 옮겼다. Main 직접 편집에서 현재 입력의 증감만 펼치는 동작을 유지한다.
- 값 계산, 빈 값/0원 구분, 상한과 저장 시점은 입력을 소유한 기존 코드에 남긴다. `FormattedMoneyInput`의 기존 상수·타입 export는 호환 re-export로 유지한다.

## Simulation 단위 변경

[AdvancedSettings](../../../src/simulation/ui/AdvancedSettings.tsx)의 `현재 모아둔 돈`은 다음 순서로 조정한다.

| 버튼 | 변화량 |
| --- | ---: |
| -5천만 | -50,000,000원 |
| -1천만 | -10,000,000원 |
| +1천만 | +10,000,000원 |
| +5천만 | +50,000,000원 |

0원 하한, 안전 정수 상한, blur 저장과 원금 변경에 따른 목표 재평가를 유지한다. 최초 설정의 ±100만·±1000만 단위는 그대로다. Main 월 금액, Simulation 계산식, workspace schema와 Supabase RPC는 변경하지 않았다.

## 검증과 수정 이력

- `npm run check`: source·unit TypeScript 통과.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run`: 143개 파일, 1,321개 통과. 기존 구조 검사에서 직접 Button import뿐 아니라 Button 기반 공통 조합도 허용하도록 갱신했다.
- `ISF_E2E_PORT=5810 npx playwright test tests/simulation.spec.ts tests/account-workspace.spec.ts -g '계산 기준에서|expense entry and whole-plan' --output test-results/controls-capture`: 6개 통과. 390·768·1280px containment·44px·수정·저장·focus 검증.
- fake Supabase 설정을 사용한 `npx vite build`: 통과. 버전 bump·배포 없음.
- 회귀 중 입력 이름과 증감 group 이름이 겹친 문제를 수정했다. 입력 이름과 별도의 공통 group 이름을 사용한다.
- 색상 대비 검사는 `color(srgb ...)`를 0~255 RGB로 오독하던 정규식 대신 canvas RGBA 변환으로 실제 CSS 색상을 측정한다. 4.5:1 기준은 유지했다.
- 이전 백업 UI fixture 정리에서 남은 `emptyAccountMapV4` 참조 한 곳을 현재 빈 Account Map 값으로 바꿨다. 제품 저장 코드는 변경하지 않았다.
- `npm run test:e2e`: 최종 전체 실행 170개 통과, 기존 PWA offline 1개 의도된 skip(3.1분).
- 변경 문서의 상대 링크 82개와 `git diff --check`: 통과.

## 화면 증거와 범위

[화면 폴더](../../reviews/2026-09-11-shared-controls/)에 지출 도우미와 Simulation 계산 기준의 390·768·1280px 캡처를 보관한다. 각 화면을 직접 검토했다. 기존 아이콘 도크·관리 메뉴 변경과 관련 없는 사용자 파일 삭제는 보존했다.

이번 범위는 금액 조정 그룹과 지속 선택 컨트롤이다. 모든 앱의 기본 Button API·IconButton·loading·danger 변형을 일괄 재설계하지 않았다. 실제 휴대폰 소프트 키보드·스크린리더·운영 계정 인증은 이 변경의 새 검증 범위가 아니다.
