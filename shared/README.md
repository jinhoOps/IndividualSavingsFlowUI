# shared

Step1/Step2 공통 모듈을 배치하는 폴더입니다.

## styles/step-theme.css

- Step 공통 테마(폰트/컬러 토큰/버튼/패널 기본 스타일)를 제공합니다.
- Step2는 이 파일을 먼저 로드하고, 전용 레이아웃 CSS로 추가 커스터마이즈합니다.

## storage/hub-storage.js

- 공통 IndexedDB 허브 DB: `isf-hub-db-v1`
- 스토어 계약:
  - `step1Snapshots`: `{ id, createdAt, updatedAt, data }`
  - `step2Portfolios`:
    - v2(현재): `{ id, modelVersion, name, totalMonthlyInvestCapacity, accounts[], notes, updatedAt }`
    - v1(레거시): `{ id, name, targetAllocations, notes, updatedAt }`
  - `bridgeStep1ToStep2`: `{ id, step1SnapshotId, payload, createdAt }`

Step1은 적용 시 `step1Snapshots`와 `bridgeStep1ToStep2`에 기록하고,
Step2는 `step2Portfolios` 저장/불러오기와 `bridgeStep1ToStep2` 읽기를 사용합니다.
레거시(v1) 포트폴리오는 로드 시 v2 계좌형 모델로 자동 변환됩니다.
