# UAT Report: Phase 08 Expense Comparison

## Test Environment
- **Browser**: Chrome (Desktop/Mobile Emulation)
- **Version**: v0.9.8
- **Base Data**: 2+ Step 1 Snapshots in IndexedDB

## Test Cases & Results

| Case ID | Feature | Test Step | Expected Result | Status |
|---------|---------|-----------|-----------------|--------|
| UAT-08-01 | Snapshot Select | 비교 대상 스냅샷 선택 드롭다운 클릭 | 저장된 모든 스냅샷이 타임스탬프 형식으로 노출됨 | Pass |
| UAT-08-02 | Comparison Chart | 특정 스냅샷 선택 후 차트 확인 | [이전] vs [현재] 막대가 카테고리별로 쌍을 이루어 표시됨 | Pass |
| UAT-08-03 | Delta Logic | 현재 지출 입력값 수정 | 차트의 [현재] 막대와 차액 수치가 실시간으로 갱신됨 | Pass |
| UAT-08-04 | New Items | 이전 스냅샷에 없던 항목 추가 | 차트에서 이전 값 0으로 정상 처리 및 'New' 표시 확인 | Pass |
| UAT-08-05 | Responsive | 모바일 뷰에서 차트 가독성 확인 | 막대 너비가 자동 조절되며 툴팁/수치 표시 정상 작동 | Pass |

## Final Verdict
과거 지출 비교 기능은 데이터 정합성과 실시간 반응성 측면에서 설계 의도대로 완벽히 동작합니다.
