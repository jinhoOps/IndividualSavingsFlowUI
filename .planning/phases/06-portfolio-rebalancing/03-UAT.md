# UAT Report: Phase 06 Portfolio Rebalancing (Step 3)

## Test Environment
- **Browser**: Chrome (Desktop), Safari (iOS - Mobile)
- **Version**: v0.9.5
- **Data State**: Step 1 Snapshot exist, Local Storage empty for Step 3.

## Test Cases & Results

| Case ID | Feature | Test Step | Expected Result | Status |
|---------|---------|-----------|-----------------|--------|
| UAT-06-01 | Step 1 Link | Step 3 접속 시 Step 1 투자 금액 로드 확인 | 상단 헤더에 '투자 가능 금액'이 Step 1과 일치하게 표시됨 | Pass |
| UAT-06-02 | CRUD Account | 계좌 추가 버튼 클릭 후 이름 입력 | 새로운 계좌 카드가 생성되고 스토리지에 저장됨 | Pass |
| UAT-06-03 | CRUD Asset | 종목 추가 후 비중, 수량, 단가 입력 | 실시간으로 해당 계좌의 총액과 비중이 계산됨 | Pass |
| UAT-06-04 | Visualization | 데이터 입력 후 도넛 차트 확인 | 전체 자산 대비 종목별 비중이 SVG 차트로 정확히 렌더링됨 | Pass |
| UAT-06-05 | Rebalancing | 목표 비중 수정 후 가이드 확인 | 목표 대비 부족한 금액만큼 '매수 가이드' 리스트가 생성됨 | Pass |
| UAT-06-06 | Snapshots | '스냅샷 저장' 후 데이터 수정, 다시 '복원' | 이전 상태로 모든 계좌/종목 데이터가 완벽히 복구됨 | Pass |
| UAT-06-07 | Responsive | 브라우저 너비를 400px로 축소 | 계좌 카드가 1열로 재배치되며 가독성 유지 | Pass |

## Final Verdict
Phase 06의 모든 요구사항(Step 3 핵심 기능)이 사용자 시나리오에 따라 정상 작동함을 확인하였습니다.
