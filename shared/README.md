# shared

Step1/Step2 공통 모듈을 배치하는 폴더입니다.

## storage/hub-storage.js

- 공통 IndexedDB 허브 DB: `isf-hub-db-v1`
- 스토어 계약:
  - `step1Snapshots`: `{ id, createdAt, updatedAt, data }`
  - `step2Portfolios`: `{ id, name, targetAllocations, notes, updatedAt }`
  - `bridgeStep1ToStep2`: `{ id, step1SnapshotId, payload, createdAt }`

Step1은 적용 시 `step1Snapshots`와 `bridgeStep1ToStep2`에 기록하고,
Step2는 `step2Portfolios` 저장/불러오기와 `bridgeStep1ToStep2` 읽기를 사용합니다.
