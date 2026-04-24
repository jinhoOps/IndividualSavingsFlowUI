---
type: node
created: 2026-04-16
tags: [data_model, indexeddb, storage, bridge, reference]
---

# Data Model Reference (데이터 모델 참조)

## 금액 단위 (Currency Units)

- **UI 입력 및 표시:** Step1과 Step2 모두 사용자 편의를 위해 `만원` 단위를 기본으로 사용합니다 (예: 350 입력 시 3,500,000원 의미). 모든 요약 카드, 차트 툴팁, 테이블 셀 등 UI에 노출되는 금액 표기는 `IsfUtils.formatMoney`를 통해 `만원` 단위로 포맷팅되어야 합니다.
- **내부 데이터 및 저장:** IndexedDB 저장, 브리지(Bridge) 데이터, 내부 계산 로직은 정밀도와 일관성을 위해 `원` 단위를 기본으로 합니다. (modelVersion 10+ 기준)
- **변환 규칙:** 
  - `만원 -> 원`: `IsfUtils.toWon(value)` (10,000 곱셈)
  - `원 -> 만원`: `IsfUtils.toMan(value)` (10,000 나눗셈)
- **표시 규칙:**
  - `IsfUtils.formatMoney(value)`: 입력된 '원' 단위를 '만원' 단위 문자열(예: "350 만원")로 변환하여 반환합니다. 소수점은 최대 2자리까지 표시합니다.
- **단위 정합성:** Step1 브리지 데이터와 Step2 드래프트의 `totalMonthlyInvestCapacity`는 모두 **원 단위**로 통일되었습니다. 임시 UI 상태에서만 만원 단위를 사용하며, 상태 저장 시에는 항상 원 단위를 준수하십시오.
- **모델 버전 관리 (Versioning):** `modelVersion: 10`은 데이터가 '원' 단위로 정규화되었음을 나타내는 핵심 지표입니다. `input-sanitizer.js`와 같은 데이터 정규화 모듈은 반환 객체에 반드시 이 버전을 포함하여, 후속 처리 과정에서 단위 중복 변환(예: 만원 -> 원 중복 곱셈)이 발생하지 않도록 해야 합니다.

## 저장 전략 (Storage Strategy)

우선순위에 따라 데이터를 로드합니다:
1. 공유 포인터 (`sid`): IndexedDB의 `snapshots` 테이블에서 고유 ID로 조회.
2. URL 해시 (`#s`): LZ 기반 압축 문자열을 디코딩하여 상태 복원.
3. 로컬 저장소 (IndexedDB): `isf-hub-db-v1`의 최신 상태 로드.
4. 기본값 (Default): 초기 샘플 데이터.

### 데이터 마이그레이션 (Migration)
앱의 정체성 변화나 리브랜딩으로 스토리지 키가 변경될 경우, 사용자 데이터 연속성을 위해 자동 마이그레이션을 수행합니다.
- **LocalStorage**: `IsfStorageHub.ensureMigration(old, new)`를 통해 스냅샷 데이터 이전.
- **IndexedDB**: `IsfBackupManager.migrateAppKey(old, new)`를 통해 백업 테이블(`backups`) 내의 앱 식별자를 일괄 업데이트하여 과거 백업 이력 보존.

### 뷰 모드 안전 저장 프로토콜 (View-Save Protocol)
외부 공유 데이터를 내 기기에 반영할 때의 무결성 보호 절차입니다.
1. `BackupManager.createManualBackup('auto/view-save')` 실행.
2. `IsfStorageHub.persistViewDataLocally(data)`를 통해 현재 세션 데이터 덮어쓰기.
3. IndexedDB 스냅샷 및 LocalStorage 동시 업데이트.

## IndexedDB 스키마 (`isf-hub-db-v1`)

| 테이블 | 설명 |
|---|---|
| `step1Snapshots` | Step1의 이력 및 브릿지용 최신 데이터 저장소 (최대 20개) |
| `step2Portfolios` | Step2의 시뮬레이션 가정 데이터 (수익률, 성장률 등) |
| `step3Portfolios` | [예정] Step3의 계좌 및 종목별 상세 비중 데이터 |
| `backups` | `BackupManager`가 관리하는 자동/수동 백업 데이터 (최대 60개) |

## 데이터 브리지 (Direct Access Pattern)

Step1의 '적용' 버튼 클릭 시, 최신 데이터가 `step1Snapshots`에 저장됩니다. Step2는 별도의 브릿지 테이블 없이 **이 테이블의 최신 레코드를 직접 조회**하여 `monthlyInvest` 데이터를 추출합니다. (v0.7.0)

- **핵심 필드**: `monthlyInvest` (원 단위 합계)
- **연동 시점**: Step 2 로딩 시 또는 상단 브릿지 배너의 '가져오기' 클릭 시.

---
*연결 노드:* [[Architecture_Reference]], [[UI_Standards_Reference]], [[Data_Bridge_Import_Pattern]]
