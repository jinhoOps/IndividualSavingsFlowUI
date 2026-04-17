# Data Model & Storage

## 금액 단위 (Currency Units)

- **UI 입력 및 표시:** Step1과 Step2 모두 사용자 편의를 위해 `만원` 단위를 기본으로 사용합니다 (예: 350 입력 시 3,500,000원 의미).
- **내부 데이터 및 저장:** IndexedDB 저장, 브리지(Bridge) 데이터, 내부 계산 로직은 정밀도와 일관성을 위해 `원` 단위를 기본으로 합니다.
- **변환 규칙:** 
  - `만원 -> 원`: `IsfUtils.toWon(value)` (10,000 곱셈)
  - `원 -> 만원`: `Math.round(value / 10000)` (현재 `IsfUtils`에 별도 헬퍼가 없으므로 수동 변환 권장)
- **주의:** Step1 브리지 데이터의 `monthlyInvestCapacity`는 원 단위이며, Step2 드래프트의 `totalMonthlyInvestCapacity`는 만원 단위이므로 연동 시 반드시 변환이 필요합니다.

## 저장 전략 (Storage Strategy)

우선순위에 따라 데이터를 로드합니다:
1. 공유 포인터 (`sid`): IndexedDB의 `snapshots` 테이블에서 고유 ID로 조회.
2. URL 해시 (`#s`): LZ 기반 압축 문자열을 디코딩하여 상태 복원.
3. 로컬 저장소 (IndexedDB): `isf-hub-db-v1`의 최신 상태 로드.
4. 기본값 (Default): 초기 샘플 데이터.

## IndexedDB 스키마 (`isf-hub-db-v1`)

| 테이블 | 설명 |
|---|---|
| `step1Snapshots` | Step1의 이력 스냅샷 |
| `bridgeStep1ToStep2` | Step1에서 Step2로 전달되는 핵심 요약 정보 |
| `step2Portfolios` | Step2의 포트폴리오 데이터 |
| `backups` | 12시간 주기로 저장되는 자동 백업 데이터 (최대 60개) |

## 데이터 브리지

Step1의 '적용' 버튼 클릭 시, Step2에서 필요한 최소 페이로드(`monthlyInvestCapacity`, `currentCash` 등)가 `bridgeStep1ToStep2` 테이블에 저장됩니다.
