# IndividualSavings Flow UIUX

`개인 자산 흐름 (IndividualSavings Flow UIUX)` 프로젝트는  
개인의 월간 현금흐름 점검부터 중장기 자산 변화 시뮬레이션까지 연결하는 UIUX를 기획 중입니다.  
현재는 단일 레포 내 다중 단계 구조로 운영합니다.

## 구조

- `apps/step1`: `나의 가계 흐름` (현재 운영중인 1단계)
- `apps/step2`: 투자 포트폴리오 구성(MVP: 계좌형 편집/도넛 시각화/저장/불러오기)
- `shared`: Step1/Step2 공통 모듈(IndexedDB 허브 스키마/브리지/공통 테마)

## 문제 정의

- 월 수입/지출 정보를 여러 앱에 나눠 관리하면 이번 달 돈의 흐름을 한눈에 보기 어렵습니다.
- 특히 "얼마를 벌고, 어디에 썼는지"를 빠르게 점검하기 어려워 가계 판단이 늦어집니다.

## 배포 페이지에서 바로 사용

- 접속:
  - 루트(자동 Step1 이동): https://jinhoops.github.io/IndividualSavingsFlowUI/
  - Step1 직접: https://jinhoops.github.io/IndividualSavingsFlowUI/apps/step1/
  - Step2 직접: https://jinhoops.github.io/IndividualSavingsFlowUI/apps/step2/
- 금액 단위: `만원` (예: `350` = `3,500,000원`)
- 기본 흐름:
  1. `입력값`에서 수입/지출/저축/투자/부채상환 값을 입력
  2. `고급 설정`에서 생활비/저축/투자 상세 항목 편집
  3. `적용`으로 반영 후 핵심 카드 + Sankey Diagram + 계산 검증표 확인

## 현재 기능

- 수입 항목 복수 추가/삭제
- 생활비/저축/투자 상세 항목 편집(항목 추가/삭제/적용)
- 저축 상세 항목별 연 이자율 설정(미입력 시 저축 기본 수익률 적용)
- Sankey Diagram 금액/% 전환, 확대/축소
- 가계 추이 계산 검증표 및 실질 순자산(현재가치) 표시
- 상태 공유/백업: 링크 복사, JSON 저장/불러오기
- 로컬 백업: 12시간 간격 자동 백업(최대 60개) + 선택 복원
- PWA 기본 적용: Service Worker + Web App Manifest(오프라인 재진입 지원)
- Step2 포트폴리오:
  - 계좌 중심 편집: `계좌명/계좌 비중(%)` + 계좌 내 자산군 비중 CRUD
  - Step2 금액 단위: `원` (월 투자 가능 금액 1개 입력, 계좌 금액은 비중으로 자동 계산)
  - 검증: 계좌별 자산 비중 합계 100% 검증(실패 시 저장 차단)
  - 도넛 시각화: `종합 도넛(월 투자 가능 금액 기준 + 자동 현금)` / `계좌별 도넛` 탭 전환
  - 기본 샘플 계좌: `국내주식`, `ISA`, `해외주식`
  - IndexedDB 저장/불러오기/삭제 + v1(`targetAllocations`) 자동 마이그레이션
  - Step1 브리지 데이터 수동 가져오기(월 투자여력 -> Step2 월 투자 가능 금액 반영, 덮어쓰기 확인)

## 저장 방식

- 우선순위: `공유 포인터(sid)` -> `URL 해시(#s)` -> `localStorage` -> 기본값
- 공유 링크 기본 구조: `?view=1&sid=...`
- 공유 포인터 DB:
  - Step1에서는 브라우저 `IndexedDB`에 `sid -> 상태 JSON` 스냅샷을 저장/조회합니다.
  - Step2에서는 동일 구조를 서버 DB로 확장할 수 있게 설계했습니다.
- 단계 간 브리지 DB(`isf-hub-db-v1`):
  - `step1Snapshots`: Step1 적용 시점 상태 스냅샷
  - `bridgeStep1ToStep2`: Step2 전달용 최소 payload
    - `monthlyInvestCapacity`, `currentCash`, `currentInvest`, `currentSavings`, `timestamp`
  - `step2Portfolios`:
    - v2(현재): `{ id, modelVersion, name, totalMonthlyInvestCapacity, accounts, notes, updatedAt }`
    - v1(레거시): `{ id, name, targetAllocations, notes, updatedAt }` (로드 시 자동 변환)
- 예외 모드(fallback):
  - DB 없이도 공유가 가능하도록 `#s=...` 압축 해시를 함께 사용할 수 있습니다.
  - 해시는 `LZ 기반 압축 + URI safe` 인코딩을 사용합니다.
- `보기 링크(?view=1)`로 열면 로컬 작업 데이터는 자동 덮어쓰기 되지 않습니다.
- 자동 백업은 브라우저 `IndexedDB`에 저장됩니다. (기존 `localStorage` 백업은 자동 마이그레이션)

## 로컬 실행(선택)

```bash
git clone https://github.com/jinhoOps/IndividualSavingsFlowUI.git
cd IndividualSavingsFlowUI
```

- 루트 `index.html`: Step1으로 자동 이동
- Step1 직접 실행: `apps/step1/index.html`
- Step2 직접 실행: `apps/step2/index.html`
