# IndividualSavings Flow UIUX

개인 재무 흐름을 입력하고 향후 장기 투자 전략과 실행 계획으로 연결할 수 있도록 준비하는 로컬 우선 웹 앱입니다.

현재 제품은 Main이며, 세 개의 후속 목적지는 새 앱으로 개발하기 전 준비 화면만 제공합니다.

- **Main**: 월 실수령액, 소비, 저축, 투자와 남는 돈을 한눈에 보여주는 현재 제품 기준선입니다.
- **Simulation**: 향후 새로 개발할 앱입니다. 현재는 Main의 최소 요약과 갱신 시각을 확인하는 준비 화면입니다.
- **Portfolio**: 향후 새로 개발할 앱입니다. 현재는 Simulation에서 이어진 최소 요약을 확인하는 준비 화면입니다.
- **Account Map**: 향후 새로 개발할 앱입니다. 현재 준비 화면은 Main 또는 journey 데이터를 읽거나 저장하지 않습니다.

배포 페이지: https://jinhoops.github.io/IndividualSavingsFlowUI/

## 제품 컨셉

ISF는 단순히 수입과 지출을 기록하는 도구가 아닙니다. 지금 들어오는 돈이 생활비, 저축, 투자와 여러 계좌로 어떻게 흘러가는지 이해하고, 현재 선택이 앞으로의 자산에 어떤 차이를 만들 수 있는지 살펴보기 위한 개인 재무 플래닝 도구입니다.

사용자는 자신의 현재 현금흐름을 정리한 뒤 투자 기간과 수익률 같은 가정을 바꾸며 N년 후 기대 자산과 월 현금흐름을 비교할 수 있습니다. 그 결과를 적립식 포트폴리오와 실제 계좌 흐름으로 연결해, 막연한 목표를 매달 실행할 수 있는 계획으로 구체화합니다.

여기서 보여주는 미래 값은 확정된 예측이나 수익 보장이 아닙니다. 사용자가 입력한 현재 상황과 가정을 바탕으로 여러 선택지를 비교하고 더 나은 질문을 만들기 위한 계획용 시나리오입니다.

## 프로젝트 목표

ISF의 현재 Main은 다음 두 질문에 답하고, 나머지 질문은 향후 신규 앱이 담당합니다.

- 내 월 수입은 어디로 흘러가는가?
- 생활비, 저축과 투자 비중은 현재 계획에 맞는가?
- **향후 Simulation**: 남는 현금흐름을 투자하면 장기적으로 어떤 차이가 생기는가?
- **향후 Portfolio**: 선택한 전략을 어떤 적립식 포트폴리오로 실행할 것인가?
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

### 앱 여정 준비 화면

Main에 적용된 계획이 있으면 `Simulation으로 이어가기`로 최소 `JourneySnapshot`을 저장한 뒤 Simulation 준비 화면으로 이동할 수 있습니다. 준비 화면은 연결 상태, 월 투자 가능액과 Main 갱신 시각을 보여주고 Portfolio 준비 화면까지 같은 계약으로 이어집니다.

런처의 제품 가용 상태는 Main `사용 중`, Simulation·Portfolio·Account Map `준비 중`으로 고정됩니다. 현재 위치는 이 상태와 별도로 표시됩니다. 준비 화면은 계산, 편집, 독립 제품 저장 또는 Main write-back을 수행하지 않습니다.

## 향후 신규 앱

### Simulation

Main의 월 투자 여력을 가져와 여러 장기 투자 전략의 총자산과 월 현금흐름을 비교하는 신규 앱으로 설계할 예정입니다.

### Portfolio

선택한 투자 방향을 종목·자산별 적립 금액과 비중으로 구체화하는 신규 앱으로 설계할 예정입니다.

### Account Map

Main의 계좌 데이터를 명시적으로 읽어 독립 초안에서 입금·이체·결제 관계를 검토하는 신규 앱으로 설계할 예정입니다. 향후에도 Account Map 변경은 Main에 암묵적으로 write-back하지 않습니다.

각 신규 앱의 상세 기능은 별도 승인 명세에서 정의하며, 해당 레거시 기능 목록·데이터 호환 정책·참조 제거·회귀 검증·삭제 계획을 함께 승인받아야 합니다.

## 공유 인프라

현재 Main과 준비 화면은 다음 기반을 공유합니다.

- 네 목적지 앱 런처와 현재 위치 표시
- Main의 데이터 허브, 브라우저 로컬 저장과 IndexedDB 백업
- Main의 JSON 내보내기·가져오기와 구버전 데이터 정규화
- 목적지별 최소 journey 저장
- PWA 매니페스트와 서비스워커
- 공통 디자인 토큰과 버튼·패널 스타일

데이터는 기본적으로 브라우저에 저장됩니다. 사용자가 직접 내보내거나 공유할 때만 외부로 이동합니다.

## 제품 원칙

- **요약 먼저**: 기본 화면은 입력 폼보다 현재 상태와 다음 행동을 먼저 보여줍니다.
- **하나의 기본 편집 경로**: Main의 일반 재무 항목 편집은 Financial Detail Modal에서 완료합니다.
- **명시적 저장**: 큰 편집은 적용 전까지 draft로 유지합니다.
- **로컬 우선**: 서버 계정 없이 브라우저 저장소와 백업으로 동작합니다.
- **한국어 금액 UX**: 사용자는 만 원·억 원 단위로 읽고 내부 계산과 저장은 원 단위를 유지합니다.
- **시각화 중심**: 현재 Main의 Sankey와 향후 앱별 시각화는 숫자의 관계를 설명해야 합니다.
- **명시적 연결**: 현재 앱 간 데이터 전달은 사용자 CTA와 최소 `JourneySnapshot`을 사용합니다.
- **책임 분리**: 준비 화면은 상세 상태를 소유하지 않으며, 향후 신규 앱의 독립 상태는 각 상세 명세에서 정의합니다.

## Legacy Migration Status

아직 이관하지 않은 기능이나 데이터 호환성 지식이 남아 있는 레거시 코드는 임시로 보존합니다.

레거시는 지원되는 사용자 경로나 신규 기능의 기반이 아닙니다. 각 기능을 목록화하고 현재 제품에 필요한지 판정한 뒤, 필요한 기능은 현재 책임 경계로 이관하고 불필요한 기능은 폐기 근거를 기록합니다. 사용자 동작과 구버전 저장 데이터의 호환성을 검증하고 모든 runtime·route·selector·storage·test 참조를 제거한 후 레거시 구현을 삭제합니다.

현재 전환 단계에서는 레거시 런타임 코드를 삭제하지 않습니다.

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

이 저장소는 Vite 기반 정적 멀티페이지 앱입니다. 현재 Main과 세 준비 화면은 React·TypeScript·Tailwind CSS로 구성됩니다. 기존 Simulation·Portfolio·Account Map 바닐라 모듈은 정상 제품 runtime이 아니라 기능·데이터 계약 조사를 위한 레거시 참고 자원으로 보존합니다.

큰 책임 경계:

- **입력과 정규화**: 사용자 입력, 구버전 데이터와 외부 payload 정규화
- **draft와 상태**: 편집 중 상태, dirty 판정, 적용과 취소
- **현재 계산**: Main 월간 현금흐름과 장기 projection
- **현재 시각화**: Main 요약 카드와 Sankey
- **저장과 공유**: 로컬 저장, IndexedDB, JSON, ISF CODE와 compatibility bridge
- **앱 연결**: Main → Simulation → Portfolio 준비 화면의 최소 `JourneySnapshot`
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

Main 개편과 앱 여정 준비 화면은 현재 기준선입니다. 다음 제품 확장은 이 기준선을 보존하며 진행합니다.

- 승인된 상세 명세와 레거시 마이그레이션 계획에 따른 신규 Simulation
- 승인된 상세 명세와 레거시 마이그레이션 계획에 따른 신규 Portfolio
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
- [Active Roadmap](.planning/ROADMAP.md)
- [Financial Detail Editing Boundary](docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md)
- [Account Flow Decision History](docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md)

## 데이터와 주의사항

ISF는 금융기관 연동, 실시간 시세 연동, 법적 금융 자문을 제공하지 않습니다. 모든 결과는 사용자가 입력한 가정에 기반한 계획용 추정입니다.

대출, 세금, 투자와 부동산 의사결정에는 실제 금융기관 조건과 전문가 검토가 필요합니다.

## 라이선스

ISC
