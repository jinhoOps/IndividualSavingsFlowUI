# shared

앱 간 호환을 위해 남겨둔 공통 스타일과 레거시 저장소 계약입니다.

## styles/step-theme.css

- Step 공통 테마(폰트/컬러 토큰/버튼/패널 기본 스타일)를 제공합니다.
- Main과 Simulation이 이 파일을 먼저 로드하고 전용 CSS를 덧붙입니다.

## storage/hub-storage.js

- 공통 IndexedDB 허브 DB: `isf-hub-db-v1`
- 스토어 계약:
  - `step1Snapshots`: `{ id, createdAt, updatedAt, data }`
  - `step2Portfolios`:
    - v2(현재): `{ id, modelVersion, name, totalMonthlyInvestCapacity, accounts[], notes, updatedAt }`
    - v1(레거시): `{ id, name, targetAllocations, notes, updatedAt }`
  - `bridgeStep1ToStep2`: `{ id, step1SnapshotId, payload, createdAt }`

이 계약은 Portfolio 호환과 레거시 기능 파악용입니다. 현재 Simulation은 사용하지 않습니다.

현재 Simulation은 Main의 `localStorage` 키 `isf-main-v2`를 읽기 전용으로 사용하고,
자체 초안 하나만 `isf-simulation-compound-v1`에 저장합니다.
