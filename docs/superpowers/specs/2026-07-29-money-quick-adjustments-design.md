# Money Quick Adjustments Design

## Goal

Main의 모든 `MoneyField`에 대칭적인 빠른 조정 버튼 네 개를 제공한다.

- `-50만`
- `-10만`
- `+10만`
- `+50만`

`초기화` 버튼은 제거한다. 직접 입력으로 0원을 만들 수 있으므로 별도 초기화 행동을 유지하지 않는다.

## Behavior

- 각 버튼은 현재 금액에서 표시된 원 단위만큼 증감한다.
- 감소 결과는 기존 `adjustWon()` 계약에 따라 0원 아래로 내려가지 않는다.
- disabled 상태에서는 네 버튼 모두 비활성화된다.
- 초기 설정과 대시보드 편집은 같은 `MoneyField`를 사용하므로 동일하게 적용된다.
- 버튼은 기존 `quiet` variant, 터치 영역, 줄바꿈과 접근성 이름을 유지한다.

## Scope

- Modify: `src/main/ui/common/MoneyField.tsx`
- Test: `tests/unit/main/MoneyField.test.tsx`
- No schema, storage, calculation or PWA changes.

## Verification

- Focused MoneyField unit test
- TypeScript check
- Full unit suite
- Main Playwright coverage
