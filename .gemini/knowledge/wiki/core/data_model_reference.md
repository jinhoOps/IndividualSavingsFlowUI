---
type: node
title: "Data Model Reference"
description: "Data Model Reference reference documentation."
tags: [data_model, indexeddb, storage, bridge, reference, typescript]
timestamp: 2026-05-04T00:00:00Z
---


# Data Model Reference (데이터 모델 참조)

v1.1.0-alpha.1부터 강력한 타입 시스템과 현대화된 스토리지 레이어를 사용하여 데이터 무결성을 보장합니다.

## 금액 단위 (Currency Units)

# Data Model Reference (데이터 모델 참조)

v1.1.0-alpha.1부터 강력한 타입 시스템과 현대화된 스토리지 레이어를 사용하여 데이터 무결성을 보장합니다.

## 금액 단위 (Currency Units)

- **UI 입력 및 표시:** 1원 단위 직접 입력을 기본으로 사용하여 단위 연산 혼선을 근본적으로 제거합니다. 사용자의 편의를 위해 숫자를 입력하는 즉시 한글로 금액을 환산하여 표시하는 **실시간 한글 금액 힌트**(예: `1억 2,300만 원`)를 인풋 필드 하단에 상시 표출합니다.
- **내부 데이터 및 저장:** 모든 계산 및 영속화는 `원(KRW)` 단위를 기본으로 합니다.
- **Branded Types (TS)**: `Won`과 `ManWon` 타입을 구분하여 컴파일 타임에 연산 실수를 방지합니다.
  - 1원 단위 일원화 패치 이후 `src/core/types/money.ts` (및 `shared/core/utils.js`) 내의 `toWon`과 `toMan` 헬퍼 함수는 10,000배율 수학 연산 없이 **1:1 통과(Pass-through) 캐스팅 및 정수 보정**만을 수행합니다.
  ```typescript
  // 예시
  const amount: Won = MoneyUtils.toWon(inputWon); // 배율 곱 연산 없음 (1:1 캐스팅)
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
- **Active State**: 현재 편집 중인 최신 상태는 `localStorage`(`isf-step1-active` / `isf-step3-portfolios-v2`)에 즉시 저장되어 빠른 복구를 돕습니다.
- **History**: 저장 시마다 IndexedDB의 `step1_history`에 스냅샷이 쌓입니다.
- **Wipe Policy**: 대규모 아키텍처 변경 시 사용자의 동의하에 레거시 데이터를 정리(Wipe)하여 기술 부채를 제거합니다.

## 데이터 모델 정의 (SSOT)

모든 상태 구조는 `src/core/types/models.ts`에 인터페이스로 정의되어 있으며, 바닐라 JS 측에서는 통장 쪼개기(다중 계좌 분배)를 지원하는 스키마가 추가 확장되어 운용됩니다.

### Step 1 State (v2)
```typescript
export interface Account {
  id: string; // 예: "acc-salary", "acc-living", "acc-stock", "acc-cma"
  name: string; // 계좌 별칭 (예: "급여계좌", "생활비계좌")
}

export interface IncomeAllocation {
  accountId: string; // 분배할 타깃 계좌 ID
  amount: Won;       // 해당 계좌로 분배할 금액 (원 단위)
}

export interface Step1State {
  version: 2;
  incomes: {
    id: string;
    name: string;
    amount: Won;
    allocations: IncomeAllocation[]; // 다중 계좌 분배(Multi-Allocation) 스키마
  }[];
  accounts: Account[]; // 계좌 목록 프리셋
  surplusTransferAccountId: string; // 잉여현금 이체 타깃 계좌 ID
  expenseItems: (AllocationItem & { accountId: string })[]; // accountId 매핑 포함
  savingsItems: (AllocationItem & { accountId: string })[]; // accountId 매핑 포함
  investItems: (AllocationItem & { accountId: string })[];  // accountId 매핑 포함
  // ... (기타 시뮬레이션 변수 및 초기 자산)
}
```

## 데이터 브리지 (Bridge Strategy)

- **Direct Access**: Step 2는 `isfStore.loadStep1()`을 통해 Step 1의 최신 데이터를 직접 읽어와서 `monthlyInvest` 가용 금액을 시뮬레이션에 주입합니다.
- **Compatibility**: 레거시 바닐라 JS 코드들을 위해 `CompatibilityBridge.ts`가 구형 `window.IsfStorageHub` 인터페이스를 제공하지만, 내부는 현대화된 `IsfStore`를 호출합니다.

---
*연결 노드:* [Architecture_Reference](./architecture_reference.md), [UI_Standards_Reference](./ui_standards_reference.md), [Version_Management_Principles](./version_management_principles.md)
