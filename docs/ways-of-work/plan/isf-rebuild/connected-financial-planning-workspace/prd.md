# ISF 연결형 개인 재무 계획 워크스페이스 PRD

## 1. Feature Name

**ISF 연결형 개인 재무 계획 워크스페이스**

완료된 Main의 월간 가계 흐름을 기준으로 향후 장기 투자 전략, 적립식 포트폴리오와 실제 계좌 관계를 연결할 수 있도록 준비하는 로컬 우선 개인 재무 계획 제품이다.

## 2. Epic

- **Epic:** ISF 제품 기준선 확립 및 안전한 레거시 기능 마이그레이션
- **제품 상태:** Main은 현재 제품 기준선, Simulation·Portfolio·Account Map은 준비 화면만 제공하는 향후 신규 앱, 기존 동명 구현은 레거시 마이그레이션 참고 자원
- **제품 설계:** [ISF 제품 방향 및 문서 체계 정리 설계](../../../../superpowers/specs/2026-07-29-product-direction-and-documentation-design.md)
- **활성 Roadmap:** [ISF Roadmap](../../../../../.planning/ROADMAP.md)
- **제품 편집 경계:** [Financial Detail Modal Is the Only Primary Editor](../../../../../docs/adr/0001-financial-detail-modal-is-the-only-primary-editor.md)
- **계좌 흐름 결정 이력:** [Account Flow Boundary ADR](../../../../../docs/adr/0002-account-flow-belongs-to-portfolio-boundary.md)

## 3. Goal

### Problem Statement

ISF의 Main 개편은 완료되었으며 사용자는 현재 제품에서 월간 가계 흐름을 요약하고 상세 재무 항목을 수정할 수 있다. Simulation, Portfolio와 Account Map은 모두 후속 명세에서 새로 개발할 앱이며 현재 제품 경로에는 준비 화면만 있다. 이후의 핵심 과제는 Main을 다시 만드는 것이 아니라, 최소 앱 여정 계약을 유지하면서 각 신규 앱을 명세하고 레거시에 남은 유효 기능과 데이터 계약을 안전하게 판정·이관하는 것이다.

레거시 코드에는 아직 이관하지 않은 기능 또는 구버전 저장 데이터의 의미를 확인하는 데 필요한 지식이 남아 있다. 이를 너무 일찍 삭제하면 기능과 호환성이 손실될 수 있지만, 일반 사용자 경로나 신규 기능 기반으로 계속 사용하면 현재 제품과 과거 구조가 다시 뒤섞인다. 프로젝트 문서 또한 현재 제품, 과거 요구사항, 에이전트 지침과 단편 메모가 혼재해 제품 기준을 찾기 어렵다.

### Solution

ISF를 현재 제품인 Main과 세 개의 향후 신규 목적지, 공통 로컬 우선 인프라로 정의한다.

1. **Main**은 완료된 현재 제품 기준선으로서 월간 현금흐름을 요약하고 Financial Detail Modal에서 편집한다.
2. **Simulation**은 향후 새로 개발할 앱이다. 현재는 Main의 최소 요약 연결과 갱신 시각을 보여주는 준비 화면만 제공한다.
3. **Portfolio**는 향후 새로 개발할 앱이다. 현재는 Simulation 준비 화면에서 전달된 최소 요약을 확인하는 준비 화면만 제공한다.
4. **Account Map**은 향후 새로 개발할 앱이다. 현재는 상세 데이터나 초안을 읽고 저장하지 않는 준비 화면만 제공한다.
5. **레거시 코드**는 기능 및 데이터 계약 마이그레이션에만 사용하는 임시자산으로 관리하고, 이관 또는 폐기 결정과 검증이 끝난 뒤 제거한다.
6. **문서 체계**는 제품 PRD를 기준 문서로 삼고 루트에는 README, DESIGN과 역할별 기준 문서를 안내하는 AGENTS를 유지한다.

### Impact

- Main의 완료된 사용자 경험을 향후 변경의 안정된 기준으로 사용할 수 있다.
- 신규 기능이 레거시 경로를 되살리거나 중복 편집기를 만들지 않는다.
- 필요한 레거시 기능과 구버전 데이터 호환성을 잃지 않고 단계적으로 이관할 수 있다.
- 레거시 삭제 여부를 추측이 아니라 검증 가능한 증거로 판단할 수 있다.
- 개발자와 에이전트가 현재 제품, 전환 작업, 향후 기능을 구분할 수 있다.
- 사용자는 서버 계정이나 금융기관 연동 없이 Main 계획을 관리하고, 향후 앱으로 이어질 경로와 전달 정보를 확인할 수 있다.

## 4. User Personas

### 개인 재무 계획 사용자

월 수입이 생활비, 저축, 투자로 어떻게 배분되는지 이해하고 계획을 조정하려는 사용자다.

### 모바일 사용자

390px급 화면에서도 요약, 편집, 시각화와 저장 흐름을 온전히 사용하려는 사용자다.

### 저축·투자 계획 사용자

월 투자 여력을 장기 전략 비교와 실제 적립식 포트폴리오로 연결하려는 사용자다.

### 다중 계좌 사용자

급여, 생활비, 저축, 투자, 카드 결제 계좌 사이의 반복 관계를 검토하려는 사용자다.

### 가구 단위 계획 사용자

외벌이 또는 맞벌이 소득, 공동 지출, 과거 소비와 주거 구매 가능성을 함께 살펴보려는 사용자다.

### 기존 데이터 보유 사용자

구버전 저장 데이터, 백업 또는 공유 코드를 현재 제품에서도 손실 없이 사용하려는 사용자다.

### 프로젝트 유지관리자

현재 제품 동작을 보존하면서 레거시에 남은 기능과 데이터 계약을 이관하고 검증한 뒤 제거하려는 개발자다.

### 기여자와 QA 담당자

문서에서 현재 제품 범위와 완료 기준을 확인하고 외부에서 관찰 가능한 동작을 검증하려는 협업자다.

## 5. User Stories

### Main과 월간 가계 흐름

1. As a 개인 재무 계획 사용자, I want 월 수입·생활비·저축·투자·순현금흐름을 첫 화면에서 확인, so that 세부 항목을 열기 전에 현재 상태를 이해할 수 있다.
2. As a 개인 재무 계획 사용자, I want 일반 재무 항목을 하나의 Financial Detail Modal에서 편집, so that 편집 위치와 저장 방식을 혼동하지 않는다.
3. As a 개인 재무 계획 사용자, I want 변경사항을 적용하기 전까지 draft로 유지, so that 실수한 수정과 삭제를 취소할 수 있다.
4. As a 개인 재무 계획 사용자, I want 실제 값이 바뀐 경우에만 pending 상태를 확인, so that 탐색과 저장이 필요한 변경을 구분할 수 있다.
5. As a 개인 재무 계획 사용자, I want 오류가 있는 항목을 적용 전에 안내받음, so that 잘못된 재무 데이터가 저장되지 않는다.
6. As a 개인 재무 계획 사용자, I want 수입이 어디로 입금되는지와 저축 만기·수익률을 설정, so that 실제 계획을 월간 흐름과 장기 추이에 반영할 수 있다.
7. As a 개인 재무 계획 사용자, I want 흑자와 적자를 명확히 확인, so that 지속 가능한 계획인지 판단할 수 있다.
8. As a 개인 재무 계획 사용자, I want 동일한 데이터에서 요약과 Sankey와 projection을 확인, so that 화면 사이의 숫자를 신뢰할 수 있다.
9. As a 모바일 사용자, I want 작은 화면에서도 요약·modal·Sankey·pending bar를 사용, so that 데스크톱 없이 계획을 점검할 수 있다.
10. As a 기존 데이터 보유 사용자, I want 구버전 금액과 항목이 현재 schema로 정규화됨, so that 업데이트 후에도 기존 계획을 사용할 수 있다.

### 향후 신규 Simulation과 Portfolio

아래 항목은 현재 제공 기능이 아니라 각 앱의 승인된 상세 명세가 생긴 뒤 적용할 미래 사용자 요구다.

11. As a 저축·투자 계획 사용자, I want Main의 월 투자 여력을 Simulation으로 가져옴, so that 같은 값을 다시 입력하지 않는다.
12. As a 저축·투자 계획 사용자, I want 가져온 값을 Main과 분리해 실험, so that 원래 가계 계획을 훼손하지 않는다.
13. As a 저축·투자 계획 사용자, I want 지수 성장·배당 성장·커버드콜을 동일 조건으로 비교, so that 총자산과 월 현금흐름의 tradeoff를 판단할 수 있다.
14. As a 저축·투자 계획 사용자, I want 계산 가정과 한계를 확인, so that 결과를 확정적인 미래 예측으로 오해하지 않는다.
15. As a 저축·투자 계획 사용자, I want 시뮬레이션을 저장하고 다시 열거나 삭제, so that 여러 계획을 비교할 수 있다.
16. As a 저축·투자 계획 사용자, I want 포트폴리오 이름·적립 주기·자산별 금액을 설정, so that 선택한 방향을 실행 가능한 계획으로 바꿀 수 있다.
17. As a 저축·투자 계획 사용자, I want 총 매수 금액과 자산별 비중을 실시간 확인, so that 배분 오류를 저장 전에 수정할 수 있다.
18. As a 저축·투자 계획 사용자, I want 저장 전 최종 구성을 확인, so that 잘못된 포트폴리오를 확정하지 않는다.

### 향후 신규 Account Map

아래 항목은 현재 제공 기능이 아니라 승인된 Account Map 상세 명세가 생긴 뒤 적용할 미래 사용자 요구다.

19. As a 다중 계좌 사용자, I want Main의 현재 데이터로 Account Map 초안을 생성, so that 계좌 관계를 처음부터 다시 입력하지 않는다.
20. As a 다중 계좌 사용자, I want Account Map을 수정해도 Main 원본이 자동 변경되지 않음, so that 관계 검토를 안전하게 수행할 수 있다.
21. As a 다중 계좌 사용자, I want 입금·자동이체·저축·투자·결제 관계를 유형별로 구분, so that 계좌 구조를 한눈에 이해할 수 있다.
22. As a 다중 계좌 사용자, I want 개요에서는 정확한 금액을 숨기고 선택한 상세에서만 확인, so that 관계도 복잡도와 민감 정보 노출을 줄일 수 있다.
23. As a 다중 계좌 사용자, I want 고정 결제 후보를 수락하거나 제외, so that 불확실한 추천이 자동 확정되지 않는다.
24. As a 다중 계좌 사용자, I want 노드를 직접 배치하거나 자동정렬, so that 나에게 이해하기 쉬운 관계도를 유지할 수 있다.
25. As a 모바일 사용자, I want Account Map이 첫 화면의 주요 시각 요소로 보임, so that 기능 목적을 즉시 이해할 수 있다.

### 저장과 개인정보

26. As a 개인 재무 계획 사용자, I want 서버 계정 없이 브라우저에 데이터를 저장, so that 금융 계획을 외부 서비스에 맡기지 않는다.
27. As a 개인 재무 계획 사용자, I want JSON 또는 공유 코드로 직접 내보내기와 가져오기, so that 백업하고 다른 환경으로 옮길 수 있다.
28. As a 기존 데이터 보유 사용자, I want 오래된 저장 데이터가 현재 기능과 호환, so that 마이그레이션 과정에서 계획을 잃지 않는다.
29. As a 모바일 사용자, I want 오프라인에서 기존 데이터를 열람, so that 네트워크가 없어도 계획을 사용할 수 있다.

### 레거시 기능 마이그레이션

30. As a 프로젝트 유지관리자, I want 레거시 기능과 데이터 책임을 목록화, so that 삭제 전에 보존해야 할 가치를 알 수 있다.
31. As a 프로젝트 유지관리자, I want 각 레거시 기능을 이관·폐기·판정 대기로 분류, so that 코드의 존재 여부만으로 결정을 내리지 않는다.
32. As a 프로젝트 유지관리자, I want 필요한 기능을 현재 책임 경계의 모듈로 이전, so that 새 제품이 레거시 구조에 의존하지 않는다.
33. As a 프로젝트 유지관리자, I want 마이그레이션 전후의 사용자 관찰 결과를 비교, so that 기능 손실을 발견할 수 있다.
34. As a 프로젝트 유지관리자, I want 구버전 저장 데이터와 import/export 호환성을 검증, so that 기존 사용자의 데이터가 손상되지 않는다.
35. As a 프로젝트 유지관리자, I want 이관되지 않은 레거시 UI를 정상 사용자 경로에서 숨김, so that 현재 제품과 과거 제품이 중복 노출되지 않는다.
36. As a 프로젝트 유지관리자, I want 필요한 기능의 이관 또는 폐기 증거가 있을 때만 레거시를 삭제, so that 성급한 제거를 피할 수 있다.
37. As a 프로젝트 유지관리자, I want 제거 전에 runtime import·route·selector·저장 참조가 없음을 검증, so that 삭제 후 회귀를 방지할 수 있다.
38. As a QA 담당자, I want 현재 제품의 외부 동작과 공개 데이터 계약을 테스트, so that 레거시 내부 구현을 고정하지 않고 품질을 증명할 수 있다.

### 문서와 향후 제품

39. As a 기여자, I want README에서 현재 제품 구조와 실행 방법을 확인, so that 빠르게 프로젝트를 이해할 수 있다.
40. As a 기여자, I want DESIGN에서 현재 UI 계약을 확인, so that 새 화면이 일관된 사용자 경험을 유지한다.
41. As a 기여자, I want 제품 PRD에서 현재·전환·향후 상태를 구분, so that 완료된 기능과 계획을 혼동하지 않는다.
42. As a 프로젝트 유지관리자, I want 루트에 README·DESIGN·AGENTS만 유지하고 AGENTS에서 역할별 기준 문서를 안내, so that 노후 문서와 반복 초기화 없이 작업을 시작할 수 있다.
43. As a 가구 단위 계획 사용자, I want 금융 알림 텍스트를 검토 가능한 지출로 변환, so that 실제 지출 반영을 반복 입력하지 않는다.
44. As a 가구 단위 계획 사용자, I want 두 사람의 데이터를 원본을 보존한 채 병합 미리보기, so that 안전하게 공동 가계 흐름을 만들 수 있다.
45. As a 가구 단위 계획 사용자, I want 현재 지출을 과거 snapshot과 비교, so that 소비 변화를 이해할 수 있다.
46. As a 가구 단위 계획 사용자, I want 가구 소득·부채·DSR·LTV로 주택 구매 가능 범위를 추정, so that 현실적인 탐색 가격대를 정할 수 있다.

## 6. Requirements

### 6.1 Functional Requirements

#### Main

- Main은 완료된 현재 제품 기준선으로 취급해야 한다.
- 기본 화면은 상세 입력보다 월간 재무 요약과 다음 행동을 먼저 보여줘야 한다.
- 일반 수입·생활비·저축·투자 편집은 Financial Detail Modal에서 완료해야 한다.
- 변경사항은 적용 전까지 draft로 유지하고 취소할 수 있어야 한다.
- 유효성 검증 실패 시 저장을 차단하고 수정할 항목을 명확히 표시해야 한다.
- 요약, 월간 snapshot, Sankey와 projection은 동일한 정규화 데이터 계약을 사용해야 한다.
- 사용자 표시 금액은 읽기 쉬운 원화 형식을 사용하고 내부 계산과 저장은 원 단위를 유지해야 한다.

#### Current Journey Entry

- 공통 런처는 Main을 `사용 중`, Simulation·Portfolio·Account Map을 `준비 중`으로 고정 표시해야 한다.
- 현재 위치는 제품 가용 상태와 분리해 보이는 텍스트와 `aria-current`로 표시해야 한다.
- Main은 사용자가 명시적으로 이동할 때 최소 `JourneySnapshot`만 저장해야 한다.
- Simulation과 Portfolio 준비 화면은 연결 상태, 월 투자 가능액과 Main 갱신 시각을 표시해야 한다.
- 준비 화면은 `Main에서 최신 정보 가져오기` 행동과 손상·부재·저장 접근 실패 시 Main 복구 경로를 제공해야 한다.
- 준비 화면은 상세 계산, 편집, 독립 제품 저장 또는 Main write-back을 수행하지 않아야 한다.
- Account Map 준비 화면은 Main 또는 journey 데이터를 읽거나 수정하지 않아야 한다.

#### Future Simulation

- Main의 최신 투자 여력을 명시적 import로 가져올 수 있어야 한다.
- Simulation의 수정값과 저장 상태는 Main을 자동 변경하지 않아야 한다.
- 전략 비교는 동일한 기간과 납입 가정에서 총자산과 월 현금흐름을 제공해야 한다.
- 전략별 가정, 한계와 금융 면책을 표시해야 한다.
- 시뮬레이션 생성, 조회와 삭제를 지원해야 한다.

#### Future Portfolio

- 포트폴리오 이름, 적립 주기, 둘 이상의 자산과 자산별 금액을 입력할 수 있어야 한다.
- 총액과 자산별 비중을 실시간으로 계산해야 한다.
- 최종 확인 후 저장해야 한다.
- 저장한 포트폴리오의 조회, 수정과 삭제를 지원해야 한다.

#### Future Account Map

- Account Map은 Main 및 Portfolio와 구분되는 독립 목적지여야 한다.
- Main은 Account Map의 가벼운 요약과 이동 경로만 제공해야 한다.
- Account Map은 정규화된 Main 데이터를 읽어 page-owned draft를 생성해야 한다.
- 초안 생성과 수정은 Main 저장 상태를 자동 변경하지 않아야 한다.
- 관계 유형과 결제 후보 상태를 구분해야 한다.
- 개요의 금액은 숨기고 선택 상세에서만 표시해야 한다.
- 변동비와 일회성 지출은 기본 반복 관계 후보에서 제외해야 한다.
- 자동배치는 동일 데이터에 대해 결정적이어야 하고 수동 위치 저장과 초기화를 지원해야 한다.

#### Storage and Compatibility

- 핵심 기능은 서버 계정 없이 브라우저 저장소에서 동작해야 한다.
- 백업, 복원, JSON과 공유 코드 import/export를 제공해야 한다.
- 외부 및 구버전 데이터는 저장 또는 렌더링 전에 정규화해야 한다.
- 마이그레이션 실패는 현재 저장 상태에 부분 변경을 남기지 않아야 한다.
- 향후 앱별 상세 명세는 데이터 소유권과 connector의 read/write 방향을 명시해야 한다.

#### Legacy Migration

- 레거시는 사용자에게 지원되는 병행 제품이 아니라 임시 마이그레이션 자산으로 관리해야 한다.
- 레거시 기능과 데이터 책임은 이관 전에 목록화해야 한다.
- 각 항목은 `이관`, `폐기`, `판정 대기` 중 하나의 상태를 가져야 한다.
- 이관 기능은 Main, Simulation, Portfolio, Account Map, 저장 호환성 중 현재 책임이 맞는 경계로 이동해야 한다.
- 신규 기능은 레거시 모듈 위에 구현해서는 안 된다.
- 레거시 UI를 정상 사용자 경로로 다시 노출해서는 안 된다.
- 삭제 전 사용자 관찰 동작과 구버전 데이터 호환성을 검증해야 한다.
- 삭제 전 runtime import, route, selector, storage와 test 참조가 제거됐음을 확인해야 한다.
- 이 문서 단계에서는 레거시 런타임 코드를 삭제하지 않는다.

#### Documentation

- 제품 PRD는 현재 제품 범위, 전환 상태와 향후 확장의 단일 기준이어야 한다.
- 루트의 README는 제품 소개, 실행, 검증과 상세 문서 진입점을 제공해야 한다.
- 루트의 DESIGN은 현재 UI와 반응형 계약을 제공해야 한다.
- 루트의 AGENTS는 역할별로 필요한 기준 문서, 최소 저장소 규칙, 검증과 인계 방법을 안내하되 원문을 복제하지 않아야 한다.
- 루트 Markdown은 README, DESIGN과 AGENTS만 유지해야 한다.
- 기존 `.codegraph/` 상태를 재사용하고 일반 작업자는 CodeGraph를 초기화하거나 rebuild하지 않아야 한다.
- CodeGraph 복구는 상태가 없거나 실제로 사용할 수 없고 일반 탐색으로 부족할 때 Coordinator 또는 단일 graph owner만 수행해야 한다.

#### Future Product Expansion

- Simulation, Portfolio와 Account Map은 각각 승인된 상세 요구사항과 레거시 판정·호환·제거 계획을 갖춘 신규 앱으로 개발해야 한다.
- 한국어 금융 알림 텍스트는 저장 전 검토 가능한 구조화 지출 후보로 변환해야 한다.
- 가구 병합은 두 원본을 보존하고 충돌을 저장 전에 표시해야 한다.
- 과거 비교는 동일 원화 단위와 카테고리 기준을 사용해야 한다.
- 부동산 구매력 계획은 가구 소득, 부채, DSR와 LTV 가정을 설명과 함께 제공해야 한다.

### 6.2 Non-Functional Requirements

- **Local-first:** 핵심 기능은 외부 서버나 금융기관 연결 없이 동작해야 한다.
- **Privacy:** 명시적 내보내기 또는 공유 전에는 사용자 데이터를 브라우저 밖으로 전송하지 않아야 한다.
- **Accessibility:** modal focus, label, role, 오류 메시지, 키보드 조작과 그래프 대체 설명을 제공해야 한다.
- **Responsive:** 390px급 모바일과 768px 이하 화면에서 가로 넘침이나 가려진 주요 컨트롤이 없어야 한다.
- **Determinism:** 현재 계산과 정규화는 동일 입력에 동일 결과를 제공해야 하며, 향후 Account Map 자동배치도 같은 원칙을 따라야 한다.
- **Compatibility:** 기존 저장 데이터와 공유 데이터의 유효 기능을 명시적 결정 없이 잃어서는 안 된다.
- **Security:** 사용자 입력은 안전한 텍스트 또는 DOM API로 렌더링해야 한다.
- **Maintainability:** 계산, 정규화, 저장, 렌더링과 연결 책임을 분리해야 한다.
- **Design consistency:** ISF Pearl, flat editorial panel, 지정 색상·타이포그래피·피드백 규칙을 따라야 한다.
- **Financial disclaimer:** 모든 투자 및 주거 계산은 사용자 가정 기반 추정이며 금융 자문이나 승인을 의미하지 않아야 한다.

## 7. Acceptance Criteria

### AC-1 Current Main Baseline

- [ ] 기본 화면에서 월 수입·생활비·저축·투자·순현금흐름을 먼저 확인할 수 있다.
- [ ] Financial Detail Modal이 일반 재무 항목의 유일한 정상 편집 경로다.
- [ ] 변경하지 않은 modal 탐색은 dirty 상태를 만들지 않는다.
- [ ] 적용과 취소가 draft와 저장 상태를 정확히 구분한다.
- [ ] 요약, Sankey와 projection이 동일한 저장 변경을 반영한다.
- [ ] 모바일에서 modal, Sankey와 pending bar가 화면 밖으로 잘리지 않는다.

### AC-2 Connected Apps

- [ ] 런처가 Main은 `사용 중`, 세 향후 앱은 `준비 중`으로 표시하고 현재 위치를 별도로 알린다.
- [ ] Main의 명시적 CTA가 최소 스냅샷을 저장한 뒤 Simulation 준비 화면으로 이동한다.
- [ ] Simulation과 Portfolio 준비 화면이 연결 상태, 월 투자 가능액과 Main 갱신 시각을 표시한다.
- [ ] Simulation → Portfolio → Simulation 이동에서도 각 목적지의 유효한 연결이 유지된다.
- [ ] 저장 값이 없거나 손상되었거나 브라우저 저장소 읽기가 차단되어도 Main 복구 행동을 제공한다.
- [ ] 준비 화면은 상세 계산·편집·독립 제품 저장·Main write-back을 제공하지 않는다.
- [ ] Account Map은 별도 준비 목적지로 열리며 journey 또는 Main 데이터를 읽지 않는다.

### AC-3 Storage and Existing Data

- [ ] 새로고침 후 Main 저장 상태와 목적지별 유효한 journey 연결이 복원된다.
- [ ] 구버전 데이터가 현재 schema로 정규화된다.
- [ ] import 실패가 부분 저장을 만들지 않는다.
- [ ] JSON과 공유 코드가 사용자 입력을 안전하게 처리한다.
- [ ] 오프라인에서 기존 로컬 데이터를 열 수 있다.

### AC-4 Legacy Migration Gate

- [ ] 모든 제거 대상 레거시 기능에 이관·폐기·판정 대기 상태가 있다.
- [ ] 이관 대상에는 현재 소유 모듈과 검증할 외부 동작이 기록된다.
- [ ] 폐기 대상에는 현재 제품에서 필요하지 않은 이유가 기록된다.
- [ ] 이관되지 않은 레거시 UI가 정상 사용자 경로에 노출되지 않는다.
- [ ] 마이그레이션 전후 사용자 동작과 구버전 데이터 호환성이 검증된다.
- [ ] runtime import, route, selector, storage와 test 참조가 남아 있으면 삭제 완료로 판정하지 않는다.
- [ ] 모든 gate가 통과되기 전에는 레거시 런타임 코드를 삭제하지 않는다.
- [ ] 마이그레이션 완료 후 신규 기능이 레거시 모듈을 호출하지 않는다.

### AC-5 Documentation

- [ ] README가 Main 현재 상태와 세 향후 신규 목적지의 준비 상태를 설명한다.
- [ ] README가 레거시를 임시 마이그레이션 자산으로 설명한다.
- [ ] DESIGN이 현재 디자인과 반응형 계약만 설명한다.
- [ ] 제품 PRD가 `Current Product Baseline`, `Migration Transition`, `Future Product Expansion`을 구분한다.
- [ ] 루트 Markdown 목록에는 README, DESIGN과 AGENTS만 존재한다.
- [ ] AGENTS가 역할별 시작 문서, 최소 규칙, CodeGraph 단일 소유권, 변경 유형별 검증과 인계 형식을 안내한다.
- [ ] 일반 작업자가 기존 `.codegraph/`를 재초기화하거나 rebuild하도록 요구하는 현재 문서가 없다.
- [ ] 현재 기준 문서 중 AGENTS가 없어야 한다고 명시하는 문서가 없다.
- [ ] 삭제한 루트 문서의 유효 정보가 PRD, README, DESIGN, Roadmap 또는 Git 이력에 남아 있다.

### AC-6 Future Expansion Boundaries

- [ ] 지출 capture 결과는 저장 전에 사용자가 검토할 수 있다.
- [ ] 가구 병합은 원본을 보존하고 충돌을 표시한다.
- [ ] 과거 비교는 모바일에서도 범례와 카테고리를 읽을 수 있다.
- [ ] 부동산 구매력 결과는 DSR·LTV 가정과 면책을 함께 표시한다.
- [ ] 향후 기능이 현재 제공 기능처럼 문서화되지 않는다.

## 8. Implementation Decisions

### Product Boundaries

- Main은 월간 재무 상태와 편집 데이터의 기준 소유자다.
- 현재 Simulation과 Portfolio 준비 화면은 최소 `JourneySnapshot`을 읽을 뿐 상세 편집·저장 상태를 소유하지 않는다.
- 현재 Account Map 준비 화면은 Main 또는 journey 데이터를 읽거나 별도 초안을 저장하지 않는다.
- 향후 Simulation, Portfolio와 Account Map의 상세 상태 소유권은 각 승인된 신규 앱 명세에서 정의한다.
- 현재 앱 간 데이터 전달은 명시적 CTA와 최소 `JourneySnapshot` 계약을 사용한다.

### Primary Editing Boundary

- Financial Detail Modal을 Main의 유일한 일반 재무 항목 편집기로 유지한다.
- 레거시 편집기, 숨겨진 보조 편집 경로와 중복 pending control을 현재 제품에 복구하지 않는다.
- Main 기본 화면은 읽기와 다음 행동에 집중한다.

### Deep Modules

- 입력 정규화와 구버전 호환성
- 월간 snapshot과 장기 projection 계산
- Financial Detail draft, dirty 판정, 검증, 적용과 취소
- Sankey 데이터 구축
- 저장 및 compatibility bridge

향후 신규 앱은 승인된 상세 명세에 따라 Account Map draft·배치, 투자 전략 비교, Portfolio 자산 배분 같은 전용 deep module을 새로 소유한다. 현재 레거시의 동명 모듈은 제품 기준선이 아니다.

각 현재 또는 향후 모듈은 내부 구현을 노출하지 않는 작고 안정된 인터페이스로 많은 동작을 캡슐화해야 한다.

### Legacy Lifecycle

레거시 기능은 `목록화 → 필요성 판정 → 이관 또는 폐기 → 외부 동작 및 데이터 호환성 검증 → 참조 제거 → 구현 삭제` 순서를 따른다. 단순 파일 복사나 레거시 호출 래핑은 마이그레이션 완료가 아니다.

### Documentation Ownership

- PRD는 제품 요구사항과 상태의 기준이다.
- README는 사람과 에이전트의 프로젝트 진입점이다.
- DESIGN은 검증 가능한 UI 계약이다.
- Roadmap은 구현 순서와 향후 범위를 관리한다.
- ADR은 주요 결정과 폐기된 과거 방향을 기록한다.
- Git 이력은 삭제된 임시 문서와 역사 기록의 최종 보존 수단이다.

## 9. Testing Decisions

### Testing Principle

좋은 테스트는 구현 세부사항이나 레거시 내부 구조가 아니라 사용자가 관찰하는 결과와 현재 모듈의 공개 데이터 계약을 검증한다. 삭제될 레거시 함수명, DOM 중첩과 내부 호출 횟수를 고정하지 않는다.

### Current Product Coverage

- Main summary-first 흐름
- Financial Detail의 추가·수정·삭제·검증·적용·취소·이탈 경고
- 월간 계산, Sankey 합계와 projection
- Main → Simulation → Portfolio 준비 화면의 최소 스냅샷 연결과 갱신 시각
- 고정 가용 상태, 현재 위치, Main 복구, 목적지별 연결 보존
- 390px, 768px와 desktop의 런처·CTA·overflow·키보드 동작
- 저장, import/export, 백업과 오프라인 폴백

### Migration Coverage

- 레거시 기능과 현재 모듈의 사용자 관찰 결과 비교
- 구버전 저장 데이터와 현재 schema 정규화
- JSON 및 공유 데이터 호환성
- 마이그레이션 이후 레거시 runtime import, route, selector와 storage 참조 부재
- 제거 후 타입 검사, 빌드와 관련 브라우저 회귀

### Responsive Matrix

- 390px급 모바일
- 768px 이하 태블릿
- 일반 데스크톱

각 화면에서 가로 overflow, modal containment, pending bar 가림, 터치 대상과 그래프 가시성을 검증한다.

### Prior Art

- 기존 Main 브라우저 테스트의 Financial Detail lifecycle, sanitizer, Sankey와 모바일 회귀
- 레거시 Account Map 브라우저 테스트의 별도 route, Main import, 독립 저장, 후보 처리와 node layout 기록
- 레거시 Simulation과 Portfolio의 저장 및 계산 계약 테스트

Prior Art는 향후 명세의 기능·데이터 계약 조사 자료이며 현재 지원 제품 동작을 뜻하지 않는다.

## 10. Out of Scope

- 이번 문서 정리에서 레거시 런타임 코드를 즉시 삭제하는 것
- 아직 목록화되지 않은 레거시 기능의 필요 여부를 임의로 결정하는 것
- 완료된 Main 사용자 경험을 다시 설계하는 것
- 레거시 UI를 호환성 명목으로 일반 사용자 경로에 재노출하는 것
- 금융기관 실시간 연결 또는 scraping
- 실시간 시장 데이터 API와 주문 실행
- 백테스트 기능의 신규 개발 또는 유지
- Account Map 변경을 Main에 자동 write-back하는 양방향 동기화
- 전체 애플리케이션의 일괄 React 재작성
- 서버 계정, 클라우드 동기화와 실시간 협업

## 11. Delivery State

### Current Product Baseline

- Main summary-first 화면과 Financial Detail Modal 편집
- Main의 월간 snapshot, Sankey와 장기 projection
- 네 목적지 공통 런처와 Main → Simulation → Portfolio 준비 여정
- 최소 `JourneySnapshot`, 목적지별 새로고침 복구와 Main 최신 정보 경로
- Simulation, Portfolio와 Account Map의 신규 앱 준비 화면
- Main 데이터 허브, 백업·복원·공유와 공통 PWA·스타일 기반

### Migration Transition

- 기존 Simulation, Portfolio와 Account Map 상세 구현을 정상 제품 경로와 신규 runtime에서 격리
- 레거시 기능과 데이터 계약 목록화
- 현재 제품 필요 여부 판정
- 필요한 기능의 현재 모듈 이전
- 불필요한 기능의 폐기 근거 기록
- 구버전 저장 및 공유 데이터 호환성 검증
- 남은 runtime 및 test 참조 제거
- 모든 gate 통과 후 레거시 구현 삭제

### Future Product Expansion

1. 승인된 상세 명세와 레거시 마이그레이션 계획에 따른 신규 Simulation
2. 승인된 상세 명세와 레거시 마이그레이션 계획에 따른 신규 Portfolio
3. 승인된 상세 명세와 레거시 마이그레이션 계획에 따른 신규 Account Map
4. 한국어 은행·카드 알림 텍스트 기반 지출 capture
5. 두 사람의 Main 데이터를 이용한 가구 병합 미리보기
6. 과거 snapshot 대비 현재 지출 비교
7. 가구 소득·부채·DSR·LTV 기반 부동산 구매력 계획

## 12. Further Notes

- Main은 현재 완료된 제품 기준선이다. 향후 PRD는 Main 재구축이 아니라 기준선 보존과 확장을 다룬다.
- Simulation, Portfolio와 Account Map은 모두 향후 새로 개발할 앱이며 현재 동명 제품 경로는 준비 화면이다.
- 레거시 코드는 현재 제품 기능이 아니라 기능 마이그레이션을 위한 임시자산이다.
- 레거시 파일이 존재한다는 사실은 신규 기능에서 이를 사용할 근거가 아니다.
- 레거시 삭제는 필요한 기능과 데이터 계약의 이관 또는 명시적 폐기, 호환성 검증과 참조 제거가 모두 끝났을 때 수행한다.
- 과거 Portfolio·Account Map 계좌 흐름 결정과 구현은 향후 신규 앱 명세를 위한 마이그레이션 참고 이력이다.
- 모든 투자 및 주거 결과는 사용자 가정에 기반한 계획용 추정이며 실제 금융기관 조건과 전문가 판단을 대체하지 않는다.
