# IndividualSavings Flow UIUX

개인 재무 흐름을 입력하고, 장기 투자 전략과 실제 실행 계획으로 연결하는 로컬 우선 웹 앱입니다.

ISF는 하나의 거대한 금융 화면이 아니라 네 개의 연결된 목적지로 구성된 계획 워크스페이스입니다.

- **Main**: 완료된 현재 제품 기준선입니다. 월간 현금흐름을 요약하고 Financial Detail Modal에서 수입·생활비·저축·투자를 편집합니다.
- **Simulation**: Main의 월 투자 여력을 가져와 투자 전략별 장기 총자산과 월 현금흐름을 비교합니다.
- **Portfolio**: 종목·자산별 적립 금액과 비중을 정해 실행 가능한 포트폴리오로 저장합니다.
- **Account Map**: Main의 계좌 데이터를 읽어 독립 초안을 만들고 입금·자동이체·저축·투자·결제 관계를 검토합니다.

배포 페이지: https://jinhoops.github.io/IndividualSavingsFlowUI/

## 프로젝트 목표

ISF는 복잡한 재무 모델을 직접 다루지 않아도 다음 질문에 답할 수 있게 합니다.

- 내 월 수입은 어디로 흘러가는가?
- 생활비, 저축과 투자 비중은 현재 계획에 맞는가?
- 남는 현금흐름을 투자하면 장기적으로 어떤 차이가 생기는가?
- 선택한 전략을 어떤 적립식 포트폴리오로 실행할 것인가?
- 실제 계좌와 자동이체 관계는 어떻게 연결되어 있는가?

서버 계정이나 은행 연동 없이 사용자가 입력한 데이터를 브라우저 안에서 계산하고 시각화합니다.

## 현재 제품

### Main

Main은 월간 가계 흐름의 기준 데이터를 소유하는 완료된 제품 화면입니다.

- 수입, 생활비, 저축, 투자와 순현금흐름 요약
- Financial Detail Modal 기반 단일 편집 흐름
- 적용 전 draft와 명시적 적용·취소
- 계좌 배분, 저축 만기와 항목별 수익률
- 월간 Sankey와 계좌 관계 Network Map
- 장기 Projection Table
- 프리셋 기반 초기 설정
- 데이터 허브를 통한 백업, 복원과 공유

기본 화면은 세부 입력 폼보다 현재 상태와 다음 행동을 먼저 보여줍니다. 일반 재무 항목 편집은 Financial Detail Modal에서 완료합니다.

### Simulation

Simulation은 Main의 월 투자 여력을 장기 전략 비교로 확장합니다.

- 지수 성장, 배당 성장, 커버드콜 전략 비교
- 전략별 최종 자산과 월 현금흐름
- 전략 가정과 한계 안내
- Main 데이터 명시적 가져오기
- Simulation 내부 독립 수정과 저장
- 저장한 시뮬레이션 조회와 삭제

Simulation에서 값을 수정해도 Main 데이터는 자동 변경되지 않습니다.

### Portfolio

Portfolio는 투자 방향을 적립식 실행 계획으로 구체화합니다.

- 포트폴리오 이름과 적립 주기 설정
- 종목·자산별 금액 입력
- 총 매수 금액과 비중 실시간 확인
- 최종 확인 후 저장
- 저장한 포트폴리오 수정과 삭제

### Account Map

Account Map은 Main의 계좌 흐름을 별도 관계도로 검토하는 독립 목적지입니다.

- 현재 Main 데이터로 page-owned 초안 생성
- 급여 입금, 자동이체, 저축, 투자와 결제 후보 표시
- 관계 또는 계좌 선택 후 금액, 결제일과 메모 확인
- 고정 결제 후보 수락 또는 제외
- 결정적 자동정렬과 수동 노드 위치 저장
- Main 원본에 대한 암묵적 write-back 금지

Main에는 가벼운 Account Map 요약과 이동 경로만 존재합니다.

## 공유 인프라

네 앱은 다음 기반을 공유합니다.

- 공통 헤더와 앱 런처
- 데이터 허브 모달
- 브라우저 로컬 저장과 IndexedDB 백업
- JSON 내보내기와 가져오기
- ISF CODE 기반 공유
- 구버전 데이터 정규화와 compatibility bridge
- PWA 매니페스트와 서비스워커
- 공통 디자인 토큰과 버튼·패널 스타일

데이터는 기본적으로 브라우저에 저장됩니다. 사용자가 직접 내보내거나 공유할 때만 외부로 이동합니다.

## 제품 원칙

- **요약 먼저**: 기본 화면은 입력 폼보다 현재 상태와 다음 행동을 먼저 보여줍니다.
- **하나의 기본 편집 경로**: Main의 일반 재무 항목 편집은 Financial Detail Modal에서 완료합니다.
- **명시적 저장**: 큰 편집은 적용 전까지 draft로 유지합니다.
- **로컬 우선**: 서버 계정 없이 브라우저 저장소와 백업으로 동작합니다.
- **한국어 금액 UX**: 사용자는 만 원·억 원 단위로 읽고 내부 계산과 저장은 원 단위를 유지합니다.
- **시각화 중심**: Sankey, Network, 전략 비교와 포트폴리오 비중으로 숫자의 관계를 설명합니다.
- **명시적 연결**: 앱 간 데이터 전달은 사용자의 가져오기 행동과 정의된 connector를 사용합니다.
- **책임 분리**: Main, Simulation, Portfolio와 Account Map은 각자의 수정 및 저장 상태를 소유합니다.

## Legacy Migration Status

아직 이관하지 않은 기능이나 데이터 호환성 지식이 남아 있는 레거시 코드는 임시로 보존합니다.

레거시는 지원되는 사용자 경로나 신규 기능의 기반이 아닙니다. 각 기능을 목록화하고 현재 제품에 필요한지 판정한 뒤, 필요한 기능은 현재 책임 경계로 이관하고 불필요한 기능은 폐기 근거를 기록합니다. 사용자 동작과 구버전 저장 데이터의 호환성을 검증하고 모든 runtime·route·selector·storage·test 참조를 제거한 후 레거시 구현을 삭제합니다.

현재 문서 정리 단계에서는 레거시 런타임 코드를 삭제하지 않습니다.

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

이 저장소는 Vite 기반 정적 멀티페이지 앱입니다. 바닐라 ES 모듈이 현재 런타임의 중심이며 TypeScript core와 React 의존성은 점진적 확장 기반으로 남아 있습니다.

큰 책임 경계:

- **입력과 정규화**: 사용자 입력, 구버전 데이터와 외부 payload 정규화
- **draft와 상태**: 편집 중 상태, dirty 판정, 적용과 취소
- **계산**: 월간 현금흐름, 장기 projection, 전략 비교와 포트폴리오 비중
- **시각화**: 요약 카드, Sankey, Network, Account Map과 전략 비교
- **저장과 공유**: 로컬 저장, IndexedDB, JSON, ISF CODE와 compatibility bridge
- **앱 연결**: Main 데이터를 읽는 Simulation 및 Account Map connector
- **공통 UI**: 헤더, 데이터 허브, 피드백, 테마와 PWA

## 검증 기준

최소 정적 검증:

```bash
npm run check
```

사용자 흐름을 변경했다면 관련 Playwright 테스트를 실행합니다.

```bash
npm run test:e2e -- --reporter=list
```

Main Financial Detail 회귀:

```bash
npm run test:e2e -- -g "Phase 10.6" --reporter=list
```

Account Map 회귀:

```bash
npx playwright test tests/account-map.spec.ts --reporter=list
```

## 현재 로드맵

Main 개편과 Account Map 기반은 완료되었습니다. 다음 제품 확장은 현재 기준선을 보존하며 진행합니다.

- 한국어 은행·카드 알림 텍스트 기반 지출 capture
- 두 사람의 Main 데이터를 이용한 가구 병합 미리보기
- 과거 snapshot 대비 현재 지출 비교
- 가구 소득·부채·DSR·LTV 기반 부동산 구매력 계획
- Main·Simulation·Portfolio 사이의 계획-비교-실행 연결 강화
- 필요한 레거시 기능의 현재 모듈 이관과 검증 후 제거

## 제품 문서

- [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)
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
