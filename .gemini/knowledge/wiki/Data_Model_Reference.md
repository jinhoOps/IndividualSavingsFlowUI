---
type: node
created: 2026-05-04
tags: [data_model, indexeddb, storage, bridge, reference, typescript]
---

# Data Model Reference (데이터 모델 참조)

v1.1.0-alpha.1부터 강력한 타입 시스템과 현대화된 스토리지 레이어를 사용하여 데이터 무결성을 보장합니다.

## 금액 단위 (Currency Units)

- **UI 입력 및 표시:** 사용자 편의를 위해 `만원` 단위를 기본으로 사용합니다 (예: 350 입력 시 3,500,000원 의미).
- **내부 데이터 및 저장:** 모든 계산 및 영속화는 `원` 단위를 기본으로 합니다.
- **Branded Types (TS)**: `Won`과 `ManWon` 타입을 구분하여 컴파일 타임에 연산 실수를 방지합니다.
  - `src/core/types/money.ts`에 정의된 `MoneyUtils`를 사용하여 변환하십시오.
  ```typescript
  // 예시
  const amount: Won = MoneyUtils.toWon(inputManWon);
  ```

## 저장 레이어 (IsfStore v2)

기존 `isf-hub-db-v1`은 폐기되었으며, `isf-v2-db` (v2) 체제로 일원화되었습니다.

### IndexedDB 스키마 (`isf-v2-db`)

| 테이블 | 설명 |
|---|---|
| `step1_history` | Step1의 상태 이력. `updatedAt` 기준 최신 50개 보관. |
| `step2_simulations` | Step2의 시뮬레이션 가정(Portfolio) 데이터 저장소. |
| `backups` | `BackupService`가 관리하는 자동/수동 백업 데이터 (최대 60개). |

### 저장소 관리 규칙
- **Active State**: 현재 편집 중인 최신 상태는 `localStorage`(`isf-step1-active`)에 즉시 저장되어 빠른 복구를 돕습니다.
- **History**: 저장 시마다 IndexedDB의 `step1_history`에 스냅샷이 쌓입니다.
- **Wipe Policy**: 대규모 아키텍처 변경 시 사용자의 동의하에 레거시 데이터를 정리(Wipe)하여 기술 부채를 제거합니다.

## 데이터 모델 정의 (SSOT)

모든 상태 구조는 `src/core/types/models.ts`에 인터페이스로 정의되어 있습니다.

### Step 1 State (v2)
```typescript
export interface Account {
  id: string; // 예: "acc-salary", "acc-living", "acc-stock"
  name: string; // 계좌 별칭 (예: "급여계좌", "생활비계좌")
}

export interface Step1State {
  version: 2;
  incomes: BaseItem[]; // Won 단위, accountId 포함
  accounts: Account[]; // 계좌 목록 프리셋
  surplusTransferAccountId: string; // 잉여현금 이체 타깃 계좌 ID
  expenseItems: AllocationItem[]; // accountId 포함
  savingsItems: AllocationItem[]; // accountId 포함
  investItems: AllocationItem[]; // accountId 포함
  // ... (기타 시뮬레이션 변수 및 초기 자산)
}
```

## 데이터 브리지 (Bridge Strategy)

- **Direct Access**: Step 2는 `isfStore.loadStep1()`을 통해 Step 1의 최신 데이터를 직접 읽어와서 `monthlyInvest` 가용 금액을 시뮬레이션에 주입합니다.
- **Compatibility**: 레거시 바닐라 JS 코드들을 위해 `CompatibilityBridge.ts`가 구형 `window.IsfStorageHub` 인터페이스를 제공하지만, 내부는 현대화된 `IsfStore`를 호출합니다.

---
*연결 노드:* [[Architecture_Reference]], [[UI_Standards_Reference]], [[Version_Management_Principles]]
