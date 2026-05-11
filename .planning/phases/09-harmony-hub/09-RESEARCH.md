# Research: Phase 09 Newlywed Harmony Hub

## 1. Smart Clipboard Parser Analysis

### Typical SMS Formats (Korea)
1. **신한카드**: `[Web발신]\n신한카드승인 이*호(6115) 05/11 14:20\n15,600원(일시불)\n쿠팡`
2. **현대카드**: `[현대카드]-승인\n이*호\n15,600원(일시불)\n05/11 14:20\n쿠팡`
3. **토스뱅크**: `[토스뱅크] 05/11 14:20 이*호님에게 15,600원 결제(쿠팡)`

### Extraction Requirements
- **Amount**: `(\d{1,3}(,\d{3})*)` + `원`
- **Merchant**: Usually at the end or in parenthesis.
- **Date**: `MM/DD` or `YYYY/MM/DD`

### Mapping Logic
- 사용자가 기존에 입력한 `expenseItems`의 이름과 파싱된 '상호명' 간의 유사도(Levenshtein Distance)를 계산하여 카테고리 자동 매핑 제안.

## 2. Dual-Flow Merge Strategy

### Data Schema Expansion
현재 `state.inputs`는 단일 사용자 데이터입니다. 통합 허브에서는 다음과 같은 구조를 고려합니다.
```json
{
  "userA": { "inputs": { ... } },
  "userB": { "inputs": { ... } },
  "merged": {
    "incomes": [ ...combined... ],
    "expenseItems": [ ...combined... ],
    "netAssets": userA.net + userB.net
  }
}
```

### Merging Rules
- **Income**: 합산.
- **Fixed Expenses**: 중복 제거 또는 합산 (예: 주거비는 하나로 통합, 식비는 합산).
- **Assets**: 합산하여 단일 시뮬레이션 엔진으로 전달.

## 3. UI/UX Flow
1. **Entry**: Step 1 상단 또는 설정 메뉴에 '부부 통합 허브' 진입점 추가.
2. **Integration**: 상대방의 'ISF CODE'를 입력받아 데이터 가져오기.
3. **Visualization**: 두 데이터가 합쳐진 Sankey Diagram 및 통합 자산 성장 곡선 출력.
4. **Quick Add**: 클립보드 파서 팝업을 통해 지출 내역 즉시 반영.

## 4. Technical Constraints
- **Security**: 서버 저장 없이 LocalStorage/IndexedDB에서만 동작. (Privacy First)
- **Code Reuse**: 기존 `calculator.js`와 `sankey-builder.js`를 재사용하되, 입력값만 합산하여 전달하는 Wrapper 필요.
