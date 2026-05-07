# Phase 08 Summary: Expense Comparison

## Accomplishments
Phase 08은 사용자가 저장한 과거의 지출 스냅샷을 현재의 지출과 비교하여 변화를 시각적으로 분석할 수 있는 도구를 구현했습니다.

- **Snapshot API Enhancement**: IndexedDB에서 과거 스냅샷 목록을 조회하고 특정 스냅샷을 가져오는 기능을 `SnapshotManager`에 추가했습니다.
- **Comparison Engine**: 이전 데이터와 현재 데이터 간의 차액(Delta) 및 변화율을 계산하는 로직을 구현했습니다. 새로운 항목이나 삭제된 항목에 대해서도 정확하게 대응합니다.
- **Visual Analytics**: SVG 기반의 Grouped Bar Chart를 통해 카테고리별 [이전] vs [현재] 지출을 직관적으로 비교할 수 있는 UI를 구축했습니다.
- **Reactive Integration**: 현재 지출 입력이 변경될 때마다 비교 차트가 실시간으로 업데이트되도록 `app.js`와 연동했습니다.

## Verification Results
- **데이터 정합성**: 스냅샷 데이터 로딩 및 차액 계산 로직의 정확성을 검증했습니다.
- **UI 무결성**: 다양한 수의 카테고리(항목 추가/삭제) 상황에서도 차트 레이아웃이 유연하게 대응함을 확인했습니다.
- **반응형 대응**: 모바일 환경에서 비교 섹션의 가독성과 상호작용이 유지됨을 확인했습니다.

## Impact
사용자는 자신의 지출 패턴이 과거에 비해 어떻게 변화했는지 수치와 그래프로 확인하여, 불필요한 지출을 줄이거나 예산을 재분배하는 데 도움을 받을 수 있습니다.
