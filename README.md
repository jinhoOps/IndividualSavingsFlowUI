# IndividualSavings Flow UIUX

개인 재무 흐름을 입력하고 향후 장기 투자 전략과 실행 계획으로 연결할 수 있도록 준비하는 로컬 우선 웹 앱입니다.

현재 상세 제품은 Main, Simulation과 Portfolio이며, Account Map은 신규 개발 전 준비 화면입니다.

- **Main**: 월 실수령액, 소비, 저축, 투자와 남는 돈을 한눈에 보여주는 현재 제품 기준선입니다.
- **Simulation**: Main의 월 저축·투자를 기준으로 장기 복리 성장과 전부 저축 기준선을 비교합니다.
- **Portfolio**: 최신 Main 투자금을 자유 이름 투자 대상과 현금에 금액·비율로 배분하는 현재 제품입니다.
- **Account Map**: 향후 새로 개발할 앱입니다. 현재 준비 화면은 Main 또는 journey 데이터를 읽거나 저장하지 않습니다.

배포 페이지: https://jinhoops.github.io/IndividualSavingsFlowUI/

## 제품 컨셉

ISF는 단순히 수입과 지출을 기록하는 도구가 아닙니다. 지금 들어오는 돈이 생활비, 저축과 투자로 어떻게 나뉘는지 이해하고, 현재 선택을 장기 계획과 실제 실행으로 연결해 가기 위한 개인 재무 플래닝 도구입니다.

현재는 월간 현금흐름을 정리하는 Main, N년 후 기대 자산을 비교하는 Simulation과 최신 Main 투자금을 배분하는 Portfolio를 제공합니다. 앞으로는 이 계획을 실제 계좌 흐름으로 연결하는 Account Map을 별도 명세에 따라 개발하려 합니다.

여기서 보여주는 미래 값은 확정된 예측이나 수익 보장이 아닙니다. 사용자가 입력한 현재 상황과 가정을 바탕으로 여러 선택지를 비교하고 더 나은 질문을 만들기 위한 계획용 시나리오입니다.

## 프로젝트 목표

ISF의 Main, Simulation과 Portfolio는 다음 질문 중 현재 제품 범위에 답하고, 마지막 질문은 향후 Account Map이 담당합니다.

- 내 월 수입은 어디로 흘러가는가?
- 생활비, 저축과 투자 비중은 현재 계획에 맞는가?
- **Simulation**: 정한 월 저축·투자가 장기 복리로 얼마나 커지는가?
- **Portfolio**: 선택한 전략을 어떤 투자 대상으로 배분할 것인가?
- **향후 Account Map**: 실제 계좌와 자동이체 관계는 어떻게 연결되어 있는가?

서버 계정이나 은행 연동 없이 사용자가 입력한 데이터를 브라우저 안에서 계산하고 시각화합니다.

## 현재 제품

### Main

Main은 월 실수령액, 소비, 저축, 투자와 남는 돈을 한눈에 보여줍니다.

처음에는 월 실수령액, 주거 고정비, 평균 생활비, 저축, 투자를 빠르게 입력합니다. 각 단계에서 현재 계획과 남는 돈을 바로 확인하고, 마지막 확인 화면에서 소비, 저축, 투자, 남는 돈의 비율을 살펴본 뒤 계획을 적용합니다. 적용 후에는 대시보드에서 같은 수치를 확인하고 수정할 수 있습니다.

Main에서 다루는 주요 내용:

- 월간 현금흐름 요약
- 2분 빠른 설정과 중간 이탈 후 재개
- 소비, 저축, 투자, 남는 돈의 금액과 비율
- 월 실수령액과 월간 계획 수치 편집
- JSON 백업 내보내기와 가져오기

### Simulation

Main에 적용된 계획이 있으면 `Simulation으로 이어가기`가 URL로만 이동합니다. 최초에는 시작 원금과 기간·기대수익률을 두 단계로 설정하고, 이후에는 결과로 바로 진입합니다. Simulation은 진입할 때마다 `isf-main-v2`의 최신 Main 월 저축·투자를 직접 읽되 Simulation 설정과 Main 원본은 변경하지 않습니다.

기간은 현재를 뜻하는 0년부터 30년까지 조정합니다. 결과는 한국식 정수 금액, 전체 폭 성장 그래프와 전부 저축 비교를 제공하며 pointer·touch·keyboard로 연도별 상세를 확인할 수 있습니다.

런처는 Main, Simulation, Portfolio와 Account Map을 한 줄 아이콘으로 표시합니다. 현재 앱은 선택선으로 구분하고 Account Map만 중립 점과 도움말에서 `준비 중`임을 알립니다. 아이콘의 한글·영문 명칭은 hover, keyboard focus, 모바일 길게 누르기 또는 `?` 도움말로 확인할 수 있습니다.

## Portfolio와 향후 Account Map

### Portfolio

최신 Main 투자금을 직접 읽어 최대 10개 자유 이름 투자 대상과 현금에 배분합니다. 금액 또는 비율로 편집하고 결과에서는 두 값을 도넛과 표로 함께 확인합니다. Portfolio는 적용 계획 하나와 초안을 저장하며 Main을 수정하지 않습니다. 계좌, 시세, 수익률과 복수 계획은 현재 범위가 아닙니다.

선택한 투자 방향을 종목·자산별 적립 금액과 비중으로 구체화합니다.

### Account Map

Account Map의 독립 상태 소유권과 필요한 read contract는 향후 승인되는 상세 명세에서 정의합니다. 해당 명세 전에는 특정 Main 데이터를 읽는 것으로 선결정하지 않으며, 향후에도 Account Map 변경은 Main에 암묵적으로 write-back하지 않습니다.

각 신규 앱의 상세 기능은 별도 승인 명세에서 정의하며, 해당 레거시 기능 목록·데이터 호환 정책·참조 제거·회귀 검증·삭제 계획을 함께 승인받아야 합니다.

## 공유 인프라

현재 Main, Simulation, Portfolio와 Account Map 준비 화면은 다음 기반을 공유합니다.

- 네 목적지 앱 런처와 현재 위치 표시
- Main의 데이터 허브, 브라우저 로컬 저장과 IndexedDB 백업
- Main의 JSON 내보내기·가져오기와 구버전 데이터 정규화
- URL 기반 앱 탐색과 앱별 명시적인 읽기 전용 Main adapter
- PWA 매니페스트와 서비스워커
- 공통 디자인 토큰과 버튼·패널 스타일

데이터는 기본적으로 브라우저에 저장됩니다. 사용자가 직접 내보내거나 공유할 때만 외부로 이동합니다.

## 제품 원칙

- **요약 먼저**: 기본 화면은 입력 폼보다 현재 상태와 다음 행동을 먼저 보여줍니다.
- **작고 명확한 입력 계약**: Main은 다섯 월간 금액만 직접 소유합니다.
- **명시적 저장**: 큰 편집은 적용 전까지 draft로 유지합니다.
- **로컬 우선**: 서버 계정 없이 브라우저 저장소와 백업으로 동작합니다.
- **한국어 금액 UX**: 사용자는 만 원·억 원 단위로 읽고 내부 계산과 저장은 원 단위를 유지합니다.
- **시각화 중심**: 현재 Main의 월 자금 구성과 향후 앱별 시각화는 숫자의 관계를 설명해야 합니다.
- **명시적 연결**: 앱 이동은 URL만 사용하고 Simulation과 Portfolio가 최신 Main을 각자의 읽기 전용 adapter로 직접 읽습니다.
- **책임 분리**: 준비 화면은 상세 상태를 소유하지 않으며, 향후 신규 앱의 독립 상태는 각 상세 명세에서 정의합니다.

## Legacy Migration Status

아직 이관하지 않은 기능이나 데이터 호환성 지식이 남아 있는 레거시 코드는 임시로 보존합니다.

레거시는 지원되는 사용자 경로나 신규 기능의 기반이 아닙니다. 각 기능을 목록화하고 현재 제품에 필요한지 판정한 뒤, 필요한 기능은 현재 책임 경계로 이관하고 불필요한 기능은 폐기 근거를 기록합니다. 사용자 동작과 구버전 저장 데이터의 호환성을 검증하고 모든 runtime·route·selector·storage·test 참조를 제거한 후 레거시 구현을 삭제합니다.

승인된 이관·폐기 gate를 통과한 레거시 Simulation과 Portfolio runtime은 제거했습니다. 사용되지 않던 journey snapshot 계약도 [승인된 폐기 설계](docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md)에 따라 제거했으며, Main은 폐기 키를 읽거나 변환하지 않고 시작 시 best-effort로 삭제합니다. Account Map 참고 자원은 신규 앱 명세 전까지 보존합니다.

## 실행하기

필요 조건:

- Node.js 20 이상 권장
- npm

설치:

```bash
npm install
```

개발 서버:

```bash
npm run dev
```

타입 체크:

```bash
npm run check
```

전체 E2E 테스트:

```bash
npm run test:e2e -- --reporter=list
```

빌드:

```bash
npm run build
```

## 개발 구조

이 저장소는 Vite 기반 정적 멀티페이지 앱입니다. 현재 Main, Simulation, Portfolio와 Account Map 준비 화면은 React·TypeScript·Tailwind CSS로 구성됩니다. 기존 Account Map 바닐라 모듈은 기능·데이터 계약 조사를 위한 레거시 참고 자원으로 보존합니다.

큰 책임 경계:

- **입력과 정규화**: 사용자 입력, 구버전 데이터와 외부 payload 정규화
- **draft와 상태**: 편집 중 상태, dirty 판정, 적용과 취소
- **현재 계산**: Main 월간 현금흐름, 잔액과 적자
- **현재 시각화**: Main 요약 카드와 월 자금 구성
- **저장과 공유**: 로컬 저장, IndexedDB, JSON, ISF CODE와 compatibility bridge
- **앱 연결**: URL로 이동하는 Main → Simulation → Portfolio 상세 화면과 Account Map-only 준비 화면
- **공통 UI**: 앱 런처, Main 데이터 허브, 피드백, 테마와 PWA

## 검증 기준

최소 정적 검증:

```bash
npm run check
```

사용자 흐름을 변경했다면 관련 Playwright 테스트를 실행합니다.

```bash
npm run test:e2e -- --reporter=list
```

Main의 빠른 설정이나 대시보드를 수정했다면 focused 회귀를 먼저 확인할 수 있습니다.

```bash
npx playwright test tests/main-react.spec.ts
```

레거시 Account Map 마이그레이션 참고 회귀는 승인된 신규 Account Map 명세의 조사·호환 작업에서만 별도로 실행합니다.

```bash
npx playwright test tests/account-map.spec.ts --reporter=list
```

## 현재 로드맵

Main, Simulation과 Portfolio는 현재 기준선입니다. 다음 제품 확장은 이 기준선을 보존하며 진행합니다.

- 승인된 상세 명세와 레거시 마이그레이션 계획에 따른 신규 Account Map
- 한국어 은행·카드 알림 텍스트 기반 지출 capture
- 두 사람의 Main 데이터를 이용한 가구 병합 미리보기
- 과거 snapshot 대비 현재 지출 비교
- 가구 소득·부채·DSR·LTV 기반 부동산 구매력 계획
- 필요한 레거시 기능의 현재 모듈 이관과 검증 후 제거

## 제품 문서

- [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
- [Agent Guide](AGENTS.md)
- [Design Contract](DESIGN.md)
- [Product Direction and Documentation Spec](docs/superpowers/specs/2026-07-29-product-direction-and-documentation-design.md)
- [Journey Snapshot Retirement Spec](docs/superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md)
- [Active Roadmap](.planning/ROADMAP.md)
- [Current Project State](.planning/STATE.md)
- [Account Flow Decision History](docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md)

## 데이터와 주의사항

ISF는 금융기관 연동, 실시간 시세 연동, 법적 금융 자문을 제공하지 않습니다. 모든 결과는 사용자가 입력한 가정에 기반한 계획용 추정입니다.

대출, 세금, 투자와 부동산 의사결정에는 실제 금융기관 조건과 전문가 검토가 필요합니다.

## 라이선스

ISC
