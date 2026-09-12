# ISF 연결형 개인 재무 계획 워크스페이스 PRD

## 1. Product

ISF는 지금의 월간 돈 흐름을 정리하고, 그 결과를 장기 전략과 실행 계획으로 점차 연결하는 개인 재무 계획 도구다. 정적 웹에서 Google 로그인과 Supabase 계정별 저장을 사용한다.

현재 지원 제품은 **Main, Simulation, Portfolio와 Account Map**이다. Main은 월 자금 흐름을, Simulation은 장기 복리를, Portfolio는 최신 Main 투자금의 전체 기준 배분을 보여준다. Account Map은 Main 기반 목적과 계좌 간 고정·남은 금액 전부 계획 흐름을 제공한다. 네 앱은 계정당 하나의 schema v5 workspace를 사용한다. 2026-09-10 v5 운영 DB 적용·Pages 배포와 실제 계정 검증을 완료했다. 이 브랜치의 계정 저장 구현과 운영 rollout 상태는 [운영 안내](../../../../../docs/supabase-account-setup.md)로 구분한다.

## 2. Epic

**Epic:** 현재 Main 기준선 확립과 안전한 신규 앱 확장

- [Design Contract](../../../../../DESIGN.md)
- [Connected Account Map Workspace Design](../../../../superpowers/specs/2026-08-06-connected-account-map-workspace-design.md)
- [Account Map Purpose-Node Flow Design](../../../../superpowers/specs/2026-08-13-account-map-purpose-node-flow-design.md)
- [Account Map Planned Account Flow Design](../../../../superpowers/specs/2026-09-04-account-map-planned-account-flow-design.md) — 현재 Account Map 계약
- [Shared Workspace Foundation Plan](../../../../superpowers/plans/2026-08-06-shared-workspace-foundation.md)
- [Journey Snapshot 폐기 설계](../../../../superpowers/specs/2026-08-03-journey-snapshot-retirement-design.md)
- [Portfolio 투자 배분 설계](../../../../superpowers/specs/2026-08-03-portfolio-allocation-design.md)

## 3. Problem

개인 재무 정보는 항목과 계좌가 늘어날수록 입력이 복잡해지고, 사용자는 정작 “지금 한 달에 얼마가 남는가”를 파악하기 어렵다. ISF는 첫 단계에서 입력 부담을 줄이고 월간 배분을 바로 이해하도록 해야 한다.

동시에 저장소에는 Account Map 참고 구현과 현재 범위 밖의 다양한 재무 기능이 남아 있다. 이 코드는 향후 기능 및 데이터 계약을 조사할 임시자산이지만 현재 제품으로 오해되거나 새 구현의 기반으로 재사용되면 제품 경계가 다시 흐려진다.

## 4. Goal

1. 사용자가 짧은 설정으로 현재 월간 현금흐름을 이해한다.
2. Main을 안정적인 현재 제품 기준선으로 유지한다.
3. 향후 앱으로 이어지는 목적과 최소 연결 상태를 보여준다.
4. 레거시에서 유효한 기능과 데이터 계약을 증거에 따라 이관한다.
5. 제품 문서가 현재 기능, 전환 작업, 미래 비전을 명확히 구분한다.

## 5. Non-goals

현재 범위는 다음을 제공하지 않는다.

- 백테스트, 변동성·MDD, 세금 또는 수수료 계산
- Portfolio 위치별 배분·계좌·보관처 편집, 복수 독립 계획, 시세·수익률·매수 실행
- 금융기관 실연동, 계좌번호·잔액·거래·실시간 시세 조회, 자동이체 실행과 금융 자문
- 은행 이체 실행, 실제 잔액·거래의 추론 또는 월 계획 흐름을 실제 자금 이동으로 표현하는 일
- 사용자 정의 지출 카테고리·거래별 실제 사용액·가구 예산 관리
- 레거시 Sankey 또는 계좌별 장기 자산 projection
- Phase C의 Main 연결 결과 카드와 별도 후속 작업인 hidden trophy room
- 구 앱 저장 키나 Main 전용 백업을 새 workspace로 가져오는 migration

위 기능은 레거시에 존재하더라도 현재 지원 기능이 아니다.

## 6. Users

### 개인 재무 계획 사용자

월 실수령액이 주거비, 생활비, 저축과 투자로 어떻게 나뉘는지 빠르게 이해하려는 사용자다.

### 모바일 사용자

390px급 화면에서도 입력, 검토, 적용과 앱 연결을 완료하려는 사용자다.

### Workspace 백업 보유 사용자

계정 저장 오류 복구가 필요할 때 기존 whole-workspace 백업을 전체 검증한 뒤 한 번에 복원하려는 사용자다. 일반 톱니 메뉴에는 수동 백업 진입점을 제공하지 않는다.

### 프로젝트 유지관리자

현재 동작을 보존하면서 레거시 기능과 데이터 계약을 판정하고 신규 앱으로 이관한 뒤 제거하려는 개발자다.

## 7. Current User Experience

### 계정 로그인

Google 로그인으로 계정의 workspace를 연다. 2026-09-10 등록한 Google 테스트 계정의 실제 연결과 기존 UID·workspace 보존을 확인했다. 로그인·재인증 화면은 Google 버튼을 먼저 제공하고, 2026-09-08 승인된 이메일·비밀번호 경로도 유지한다. 일반 Google 사용자 공개는 브랜딩 설정·앱 게시 후속 범위다. 임시 로그인의 실제 계정 사전 준비와 운영 검증은 [운영 안내](../../../../../docs/supabase-account-setup.md)를 따른다. 로그인과 workspace 조회·검증이 끝나기 전에는 금융 화면을 표시하지 않는다.

2026-09-11 후속 정정: 브랜드 장면은 새로운 실행 탭의 앱 최초 진입과 Main `처음부터 다시` 확인 후 진입에서만 재생한다. 최초 인증·계획 조회는 장면과 병렬로 진행하고, 장면은 로딩 애니메이션으로 사용하지 않고 조회 완료와 무관하게 종료한다. 조회가 남으면 로고 없이 기다리며 상태 문구는 400ms 후에만 표시한다. 같은 실행 중 앱 이동·새로고침·로그인 완료·설정 재개에서는 큰 로고를 표시하지 않는다. reduced motion은 장면을 건너뛴다. [브랜드 진입 설계](../../../../superpowers/specs/2026-09-11-account-loading-brand-motion-design.md)를 따른다.

### Main quick setup

사용자는 다음 다섯 값을 입력한다.

1. 월 실수령액
2. 월 주거 고정비
3. 월 평균 생활비
4. 월 저축액
5. 월 투자액

각 단계는 같은 `MainData` draft를 갱신한다. 사용자는 중간에 이탈한 뒤 이어서 설정할 수 있고, 마지막 검토에서 지출·저축·투자·남는 돈 또는 적자를 확인한 뒤 계획을 적용한다.

### Main dashboard

적용된 계획이 있으면 대시보드는 다음을 제공한다.

- 월간 현금흐름 요약: 월수입 금액을 직접 드러내지 않고 왼쪽에 수입 대비 저축·투자 합계 %, 오른쪽에 저축:투자 비율(두 금액 합계 100 기준)을 표시한다.
- 주거비와 생활비를 합친 지출
- 지출·저축·투자·남는 돈의 금액과 비율을 가로 배분 막대와 같은 순서의 목록으로 항상 표시한다. `자세히 보기` 버튼과 펼침 영역은 제거한다. 적자는 전체 배분을 보존하는 축척, 수입 100% 기준선과 초과 금액으로 표시한다.
- 적자 상태
- 현재 다섯 값 수정. 월 저축·월 투자 금액을 누르면 같은 편집기를 열고 해당 입력란에 초점을 둔다. 열기만으로 draft를 변경하거나 저장하지 않는다.
- `처음부터 다시` 확인 모달에서 값 유지 재시작 또는 카운트다운 표시 없이 2.5초 후 활성화되는 `초기화` 선택. 초기화는 다섯 금액이 0인 Main 재시작 초안을 저장하고 첫 설정으로 돌아간다. 기존 적용 계획은 마지막 적용까지 유지하며 취소로 돌아갈 수 있다. 지출 도우미의 중간 답변·진행·이전 반영 내역은 전부 지우며 다른 앱 데이터는 보존한다. 설정 취소는 기존 월 계획으로 돌아가지만 지운 도우미 내역을 복원하지 않는다. 전용 v5 `reset_main_setup` RPC로 초안 초기화와 내역 삭제를 원자적으로 수행하며, 실패·충돌에서는 확인 모달을 유지한다. [추가 migration](../../../../../supabase/migrations/202609110001_main_setup_reset.sql)은 배포 전에 적용해야 한다. 일반 `save_main`의 내역 보존 계약은 유지한다.
- Supabase 계정에 월간 계획 저장과 저장 실패 안내
- Simulation 진입점은 기본 화면에서 숨기고, 페이지 끝에서 새로 시작한 추가 스크롤·스와이프 또는 키보드 focus로 드러낸다. `미래 성장 보기` 버튼 활성화로만 이동하며 런처 이동은 유지한다.

### Simulation, Portfolio와 Account Map journey

- 런처는 Main, Simulation, Portfolio와 Account Map을 아이콘으로 표시하고 현재 앱을 선택선과 접근성 상태로 구분한다.
- 런처와 CTA는 URL 탐색만 수행하고 별도 전달 데이터를 저장하지 않는다.
- Simulation은 단일 workspace의 최신 Main 월 저축·투자를 읽어 장기 복리 성장과 전부 저축 기준선을 비교하고 자체 Simulation slice만 갱신한다.
- Portfolio는 같은 workspace의 최신 Main 투자금을 읽고 하나의 aggregate-only 적용 배분과 편집 초안을 소유한다.
- Portfolio 결과는 비율 우선 요약과 비례 목록으로 시작하며 원화 금액은 기본으로 숨긴다.
- Portfolio의 배분 편집은 투자 대상별 전체 기준 금액과 비율만 다루며 계좌·기관·보관처 관리 UI를 표시하지 않는다. current workspace locations는 Account Map이 소유하고, retired location-scoped Portfolio data는 현재 상태로 이관하지 않는다.
- Account Map은 최신 Main의 다섯 월 금액을 읽어 계좌 간 고정·`남은 금액 전부` 월 계획 흐름과 목적 배정을 같은 계좌 우선 지도에서 제공하고, `workspace.locations`와 `workspace.accountMap`만 갱신한다. 이 흐름은 실제 잔액·거래·자동이체가 아니다.
- Account Map은 Main·Simulation·Portfolio에 write-back하지 않는다. Main 수정은 Account Map 위에 열리는 Main 소유 편집기로만 저장한다.
- Main의 기존 요약과 월 자금 구성은 유지된다. 앱별 연결 결과 카드는 Phase C 전까지 현재 UI가 아니다.

## 8. Functional Requirements

세부 단계와 검증 gate는 [Shared Workspace Foundation Plan](../../../../superpowers/plans/2026-08-06-shared-workspace-foundation.md)을 따른다.

### 계정 인증 — 2026-09-08 임시 로그인 추가 승인

- Google 버튼을 로그인·만료 세션 재인증 화면의 첫 진입점으로 제공하고 기존 이메일·비밀번호 폼을 유지한다. 비밀번호 경로는 실제 Supabase `signInWithPassword`를 사용하며 Google 인증 결과나 JWT를 흉내 내지 않는다.
- 두 인증 경로는 이메일 문자열 대신 동일한 `auth.users.id`와 계정별 RLS·workspace 저장 계약을 사용한다. 기존 앱별 데이터 소유권과 whole-workspace 백업 형식은 바꾸지 않는다.
- 앱에는 회원가입이나 계정 자동 생성을 추가하지 않는다. 임시 대상 `okho04@gmail.com`은 운영자가 이메일 확인 완료 계정으로 사전 준비하고, 기존 사용자가 있으면 UID를 유지해 비밀번호를 설정한다.
- 실제 비밀번호는 사용자 입력으로만 전달하고 소스·문서·브라우저 저장소·공개 빌드 변수에 저장하지 않는다. 실패하면 금융 화면을 열지 않고 오류와 재시도를 제공한다.
- Google 전환 때 같은 확인된 이메일로 로그인해 전환 전후 UID와 기존 workspace 유지 여부를 실제로 확인한다. 임시 계정을 삭제·재생성하지 않는다.

### Shared workspace와 복구 호환성

- Main, Simulation, Portfolio, 공유 금융 위치와 Account Map applied/draft를 schema v5의 계정별 Supabase workspace 한 행에 저장한다.
- write ownership은 각 앱이 소유한 slice로 한정한다. Simulation과 Portfolio는 최신 Main slice를 읽기 전용으로 읽고 Portfolio는 자기 plan과 draft만 갱신한다. 모든 성공한 write는 workspace revision을 한 번 증가시킨다.
- Account Map은 Main을 읽기 전용 기준으로 사용하며 `workspace.locations`와 `workspace.accountMap`만 갱신한다.
- 공유 금융 위치 registry의 유일한 관리 진입점은 Account Map이며 Portfolio는 이를 갱신하지 않는다.
- stale revision을 기준으로 시작한 writer는 더 최신 workspace를 덮어쓰지 못한다.
- 브라우저 현재 키는 `isf-workspace-v5`다. 없을 때만 v4 → v3 → 유효한 retired v1/v2 원본을 읽기 전용 변환한다. 읽기만으로 원본을 쓰거나 삭제하지 않고 명시 저장만 source/destination lock 안에서 v5를 만든다. 존재하지만 invalid인 최신 원본에서 이전 버전으로 fallback하지 않는다.
- `isf-main-v2`, `isf-simulation-compound-v1`, `isf-portfolio-allocation-v1`, `isf-account-map-v1`, `isf-rebuild-v1`과 retired journey snapshot은 현재 workspace 제품이 읽거나 변경하지 않는 foreign record다.
- 초기 이전·오류 복구에 사용하는 백업 형식은 format 4/workspace v5이며 Main의 도우미 답변을 포함한다. format 3/v4, format 2/v3와 format 1/retired input은 역사적 strict parser와 읽기 전용 converter를 거쳐 검증한다. 모든 slice와 참조를 먼저 검증하고 한 번의 v5 replacement로 복원하며 invalid 입력은 아무것도 바꾸지 않는다.

### Main

- 다섯 월간 값을 workspace의 정규화된 Main v2 slice로 저장한다.
- 주거비와 생활비를 지출로 합산하고 총 유출과 잔액 또는 적자를 계산한다. 화면 표현은 `지출`로 통일하며 내부 `consumptionWon` 계산 키는 유지한다.
- 지출 금액은 항목별 계산 도우미, 남는 돈 금액은 저축·투자 분배 도우미를 열고, 명칭·비율은 가로 배분 막대 탐색을 제공한다. 저축·투자 금액은 같은 월 금액 편집기를 열어 해당 입력란에 초점을 둔다. 다섯 값의 직접 수정은 단일 `월 금액 편집`으로 열며 모바일 하단 고정 바, 768px 이상 요약 카드 하단에 배치한다.
- Main은 고정비·변동비 13개 항목의 금액·월/연 기준·진행 단계·마지막 완료 답변을 보조 입력으로 소유한다. 중간 답변 저장은 기존 월 금액을 보존하고 완료는 서버에서 계산한 합계로 주거비·생활비를 대체한다. 수입·저축·투자와 다른 slice는 보존한다. 재방문과 직접 금액 편집 후에도 답변을 기억한다. 상세 계약은 [지출 도우미 설계](../../../../superpowers/specs/2026-09-10-main-expense-assistant-design.md)를 따른다.
- 남는 돈 분배는 전부 저축·전부 투자·반씩 또는 직접 입력으로 기존 월 저축·투자에 추가한다. 일부를 남길 수 있고 초과 배분·0원·적자에서는 추가 적용을 막는다. 반영 전후와 남길 금액을 미리 표시하며 기존 Main 저장 경로를 사용한다. 새 저장 필드나 DB migration은 없으며 지출 답변과 다른 앱 slice를 보존한다. [남는 돈 분배 설계](../../../../superpowers/specs/2026-09-10-main-remaining-allocation-design.md)를 따른다.
- 유효하지 않은 적용은 차단하되 불완전한 setup draft는 재개할 수 있다.
- 현재 값과 적용 값의 관계를 사용자에게 명확히 보여준다.
- 현재 v5가 없을 때만 v4 → v3 → 유효한 retired workspace v1/v2 순으로 read-only conversion 후보를 읽는다. standalone 구 저장 키와 retired journey snapshot은 fallback으로 읽지 않고 foreign record로 그대로 둔다.
- 복구용 whole-workspace JSON import는 envelope, 모든 slice와 참조 검증을 통과해야 한다. 정상 Main 관리 메뉴에는 백업 내보내기·가져오기를 노출하지 않는다.

### Journey

- 2026-09-10 사용자 승인: 일반 톱니 메뉴에서 Main 백업 내보내기·가져오기와 공통 계정 백업을 제거한다. Supabase 저장을 기본으로 하며 초기 브라우저 이전·유효하지 않은 저장 상태 복구·미전송 입력 복구 경로와 백업 형식 호환성은 유지한다.
- 중복된 `앱 아이콘 안내`는 제거하고 개별 아이콘의 hover·focus·long-press 설명을 유지한다. Main 다시 시작, Simulation 다시 설정, Portfolio 보기 설정·배분 초기화, Account Map 보관 항목 복원·월 연결 다시 만들기 및 공통 계정 정보·로그아웃을 앱 상태에 맞게 제공한다.
- 390px·768px·desktop에서 메뉴의 빈 구역·불필요한 구분선·overflow가 없어야 하며 기존 44px touch target, Escape·바깥 클릭과 확인 dialog focus 계약을 유지한다.

- 앱 간 이동은 사용자의 런처 링크 또는 CTA 행동으로 시작한다.
- 앱 이동은 URL 탐색만 수행하고 Simulation과 Portfolio는 workspace의 최신 Main slice를 각자의 읽기 전용 adapter로 직접 읽는다.
- Account Map은 Main을 암묵적으로 수정하지 않는다. Main 수정 요청은 journey overlay가 Main controller와 repository로 처리하고, 저장 뒤 Account Map은 최신 revision을 다시 읽는다.

### Simulation

- 최초 진입 시 시작 원금 유무를 묻고 이후 초안은 workspace의 Simulation slice에 저장한다.
- 최초 설정은 시작 자산 → 조건부 목표 금액(시작 자산 2억 원 이상일 때) → 기대 연 수익률의 한 가지 결정씩 묻는 흐름이며, 저장된 목표가 있는 초안은 결과로 바로 진입한다. 결과 핵심 문장은 그래프의 사용자가 선택한 0~30년 기간과 독립적으로 목표 금액에 처음 도달하는 시점을 최대 30년까지 찾는다.
- 진입할 때마다 Main의 최신 월 저축·투자를 자동으로 읽되 Simulation 설정과 Main 원본은 변경하지 않는다.
- 기간, 연 기대수익률, 기준금리, 물가상승률 차이와 명목·실질금액을 조정한다. 새 Simulation 초안의 기준금리는 연 3.0%, 물가 차이는 -0.25%p로 기본 물가는 2.75%다. 기존 저장된 금리는 유지한다. `목표와 가정`은 기본으로 접고 현재 목표·시작 자산을 요약하며, 명목·실질은 항상 조정할 수 있다.
- 하단 `목표와 가정`에서 목표 금액을 1천만 원 단위 직접 입력·증감으로 변경한다. 시작 자산별 자동 1억·2억 원은 기본값으로 유지하고 기본 목표로 복원할 수 있다. 목표는 현재 모아둔 돈보다 커야 하며 변경하면 기존 월 단위 도달 계산만 다시 수행한다. 그래프 기간과 Main은 바꾸지 않는다. 기존 Simulation v3 `targetAmountWon`과 저장 경로를 사용하고 기존 원 단위 목표를 강제로 반올림하지 않는다. UI·입력 계약은 [목표 도달 요약 설계](../../../../superpowers/specs/2026-08-21-simulation-goal-milestone-design.md)의 2026-09-11 확장을 따른다.
- 새 초안 기본 기간은 5년이다. 저장된 기간은 유지하며 현재를 뜻하는 0년부터 30년까지 슬라이더와 숫자 입력으로 조정한다. 목표 도달 요약과 별도로 `N년 동안의 자산 변화` 제목을 가진 하나의 패널에 명목·실질, 그래프, 기간·수익률 조작, 보조 비교값을 묶는다.
- 현재 계획과 같은 월 납입액을 전부 기준금리 저축에 넣은 경우를 낮은 시각 우선순위로 비교한다.
- 결과 금액은 1억 원 미만에서 천 원, 1억 원 이상에서 만 원 단위로 반올림한 한국식 정수 표현을 사용한다.
- 기대수익률은 재투자를 가정한 사용자 입력값이며 백테스트나 금융 자문으로 표현하지 않는다.
- 다시 설정은 Simulation 메뉴 안에서 확인 후 실행하며 Main 원본은 변경하지 않는다.

### Portfolio와 계좌·보관처 경계

- 진입할 때마다 Main의 최신 월 투자금을 읽되 Main 원본은 변경하지 않는다.
- 최대 10개 자유 이름 투자 대상과 현금에 현재 투자금을 원화 금액으로 배분하고, 각 항목 비율은 전체 투자금 기준으로 자동 계산한다.
- 적용 계획 하나와 편집 초안을 Portfolio slice에 보존하고, 수정 중 값과 적용된 값을 구분한다.
- Main 투자금이 바뀌면 기존 배분 의도를 유지할 수 있는 범위에서 다시 계산하고 사용자가 변화를 확인하도록 한다.
- 결과는 `안정 N%` 핵심 요약과 투자 대상별 이름·비율·비례 막대를 먼저 보여주고, 총액과 항목별 원화 금액은 기본으로 렌더링하지 않는다.
- 사용자는 Portfolio 관리 메뉴에서 전체 금액 표시와 비율순·입력순 정렬을 바꾸며, 이 보기 설정은 배분 schema와 분리된 Portfolio 전용 localStorage record에 저장한다.
- 각 투자 대상은 `성장` 또는 `안정` 분류와 자동 추천·사용자 지정 출처를 소유하고, 현금은 항상 안정으로 계산한다.
- 금·채권 관련 이름의 분류는 자동 추천일 뿐이며 사용자 지정을 덮어쓰지 않는다. `ETF`만으로는 안정을 추천하지 않는다.
- 구 Portfolio standalone plan과 draft 저장값은 이관·읽기·삭제하지 않는 foreign record다.
- 유효한 aggregate plan·draft가 없으면 최신 Main 투자금을 기준으로 현금 100%인 새 aggregate draft를 시작한다.
- 다시 설정은 aggregate Portfolio 데이터만 초기화하며 Main과 다른 앱의 데이터를 변경하지 않는다.
- 현재 UI는 하나의 `aggregate` scope만 만들고 편집한다.
- current Portfolio contract와 UI는 aggregate scope만 허용하며 location-scoped values는 retired conversion에서 보존 대상이 아니다.
- Portfolio 결과는 투자 대상별 전체 기준 금액과 비율까지만 보여주며 계좌·기관·보관처 관리 UI를 제공하지 않는다.
- retired source 안의 기존 공유 금융 위치는 source를 변경하지 않은 채 conversion의 허용 범위에서만 이관하며, location-scoped Portfolio plan은 현재 aggregate plan으로 변환하지 않는다.
- 계좌·기관·보관처의 생성, 이름 변경과 보관은 Account Map만 소유한다.
- Portfolio 투자 대상과 계좌·보관처 연결은 현재 범위가 아니며 별도 승인 명세 전에는 진입점이나 연결 상태를 표시하지 않는다.

### Account Map

- 최초 생성은 목적별로 하나씩 계좌를 연결하고 이체 계획과 지도를 검토한다. 완료 후에는 계좌 정보·목적별 배정·계좌 간 흐름을 직접 편집한다. 세부 입력·반응형·복구 기준은 [계좌 맵 입력 설계](../../../../design/account-map-input-redesign.md)를 따른다.

- Main의 수입·주거·생활비·저축·투자 월 금액을 system purpose로 결정적으로 파생한다.
- 목적과 계좌·보관처를 다대다 link로 연결하고, 계좌 간에는 여러 고정 이체와 출발 계좌당 하나의 `남은 금액 전부`(sweep) 계획 흐름을 저장한다. 이체의 순서·금액 규칙은 명시적으로 선택하며 실제 이체를 실행하지 않는다.
- 지도는 전체 토폴로지를 기본으로 보여주고 주 수입 계좌를 앞세운 결정적 순서를 사용한다. 첫 pointer·touch·keyboard 선택은 연결된 상·하류와 고정/잔여 규칙, 계획상 잔여 금액 및 명시적 `계좌 정보 편집`·`연결 추가`·`흐름 편집` action을 보여준다. 두 번째 선택을 요구하지 않는다.
- 자기 이체, 중복 active pair, cycle, 없는/보관된 endpoint와 한 출발 계좌의 복수 sweep은 저장하지 않는다. 계획상 부족·미배정·Main 적자는 경고로 표시하되 저장 구조 오류로 취급하지 않는다.
- Main overlay 저장 뒤 `sourceMainUpdatedAt !== main.updatedAt`이면 한 개의 `확인 필요` 상태를 표시한다. 사용자가 `현재 Main 기준으로 확인`을 명시하면 목적별 remainder만 다시 계산하고, fixed/sweep account transfer는 바꾸지 않은 채 최신 Main 기준 시각을 기록한다. 목적 fixed allocation 초과면 오류를 알리고 어떤 write도 하지 않는다.
- 계좌·보관처 보관은 영향을 먼저 보여주고 purpose와 transfer 관계를 중지하며, 복원은 관계별 선택을 제공한다. 지도 다시 만들기는 Account Map applied/draft만 지우고 locations와 Main·Simulation·Portfolio를 보존한다.

### Legacy transition

- 신규 앱마다 기능, 계산, schema, 저장 키, import/export, route, selector와 테스트를 목록화한다.
- 각 항목을 `이관`, `재설계`, `보류`, `폐기`로 판정한다.
- 승인된 신규 앱 명세 없이 레거시 구현을 현재 runtime에 다시 연결하지 않는다.
- 호환성·참조 제거·회귀 증거가 갖춰진 뒤 해당 레거시를 삭제한다.

## 9. Data Contract

현재 제품의 저장 boundary는 Supabase `public.user_workspaces`의 계정당 한 행이며 workspace schema v5를 사용한다. 여기에는 Main applied/setup progress/expenseAssistant, Simulation draft, aggregate-only Portfolio plans/draft, 공유 금융 위치와 Account Map applied/draft(목적 link와 account transfer 포함)가 들어간다. current Account Map state에는 `legacyPhaseA`나 `layout`이 없다. RLS가 본인 행 조회를 제한하고 소유 slice별 RPC만 서버 revision 검사 후 저장한다. 전체 복원만 검증된 다섯 slice를 원자적으로 교체한다.

기존 브라우저 데이터는 사용자 선택에 따른 read-only 이전 후보다. v5 → v4 → v3 → 유효한 retired v1/v2 순으로 읽고 invalid 최신 원본에서 fallback하지 않는다. 이전 성공 후에도 원본·foreign record를 보존한다. 계정 캐시는 `isf-account-workspace-v3`/cache version 3이며 구 v2/v1의 미전송 요청을 자동 재생하지 않고 복구 원문으로 격리한다. 로그인 전 제품을 mount하지 않고 오프라인은 같은 계정 캐시의 읽기 전용 재방문만 허용한다. 기존 [계정 저장 설계](../../../../superpowers/specs/2026-09-07-supabase-account-workspace-design.md)와 [v5 확장 계약](../../../../superpowers/specs/2026-09-10-main-expense-assistant-design.md)을 따른다.

`MainData`의 제품 필드는 다음과 같다.

```ts
interface MainData {
  version: 2;
  monthlyNetIncomeWon: number;
  monthlyHousingWon: number;
  monthlyLivingWon: number;
  monthlySavingWon: number;
  monthlyInvestmentWon: number;
  updatedAt: number;
}
```

Main이 계산하는 요약:

- `consumptionWon = monthlyHousingWon + monthlyLivingWon`
- `plannedOutflowWon = consumptionWon + monthlySavingWon + monthlyInvestmentWon`
- `remainingWon = monthlyNetIncomeWon - plannedOutflowWon`

Simulation, Portfolio와 Account Map은 workspace 안의 최신 Main을 읽기 전용으로 사용한다. Portfolio는 aggregate-only 배분 plan·draft와 별도의 보기 설정 localStorage record만 현재 제품 상태로 취급한다. Simulation과 Portfolio의 write ownership은 자기 slice로 한정하고 Account Map만 자기 slice와 공유 금융 위치 registry를 갱신하며 Main·Simulation·Portfolio를 보존한다.

## 10. UX and Design Requirements

- 결과와 현재 상태를 세부 입력보다 먼저 보여준다.
- 수정 중 값과 적용된 값을 구분한다.
- 명시적 적용·백업·복구·import 결과와 저장 지연·실패·복구 필요 상태를 알린다. 정상 자동 저장 성공은 상시 상태로 반복하지 않는다.
- 원화 단위와 음수·적자 의미를 숨기지 않는다.
- 390px, 768px, desktop에서 가로 overflow 없이 사용할 수 있어야 한다.
- 앱을 이동해도 런처의 위치와 공통 화면 틀이 일관되어야 한다.
- Main 가로 배분 막대와 Simulation·Portfolio 시각화의 핵심 정보는 pointer·touch·keyboard로 탐색할 수 있어야 한다.
- 주요 터치 대상은 최소 44px을 확보한다.
- 키보드, focus, accessible name, 상태 텍스트를 제공한다.
- UI 세부 계약은 [DESIGN](../../../../../DESIGN.md)을 따른다.

## 11. Acceptance Criteria

### Current baseline

- [x] Main은 다섯 월간 값으로 새 계획을 만들고 다시 수정할 수 있다.
- [x] setup draft를 저장하고 재개할 수 있다.
- [x] 지출·저축·투자·남는 돈 또는 적자가 동일한 데이터에서 계산된다.
- [x] 유효한 계획을 계정 workspace에 저장하고 다시 불러오는 앱·DB 계약과 로컬 데이터 호환성을 검증한다. 실제 Google provider/운영 배포는 별도 rollout gate다.
- [x] 현재 JSON을 내보내고 검증된 JSON을 가져올 수 있다.
- [x] Main에서 Simulation으로 명시적으로 이동할 수 있다.
- [x] Main 월 자금 구성 가로 막대는 pointer·touch·keyboard로 항목을 탐색하며 모바일에서도 명칭과 상세 금액에 접근할 수 있다.
- [x] 앱 이동은 URL만 사용하고 Main 시작은 폐기된 journey key를 읽거나 쓰거나 변환·삭제하지 않고 foreign record로 그대로 둔다.
- [x] 네 앱 경로는 같은 런처 위치와 공통 화면 틀을 유지한다.
- [x] Simulation은 Main을 변경하지 않고 장기 복리와 전부 저축 기준선을 비교한다.
- [x] Simulation은 시작 자산·조건부 목표 금액·기대 연 수익률의 최초 설정, 재방문 결과 우선 진입과 최신 Main 자동 동기화를 제공한다. 결과 핵심 문장은 그래프 기간과 독립적인 최대 30년 목표 도달 예상 시점을 제공한다.
- [x] Simulation은 0~30년, 한국식 정수 금액, pointer·touch·keyboard 그래프 탐색을 제공한다.
- [x] Portfolio는 최신 Main 투자금을 최대 10개 투자 대상과 현금에 배분한다.
- [x] Portfolio는 기본 금액 숨김, `안정 N%` 요약과 이름·비율·비례 막대 목록으로 결과를 먼저 제공한다.
- [x] Portfolio의 성장·안정 자동 추천은 사용자 지정을 덮어쓰지 않고 현금을 항상 안정으로 계산한다.
- [x] Portfolio는 standalone retired 배분 저장값을 이관·읽기·삭제하지 않으며, aggregate plan·draft가 없으면 최신 Main 투자금의 현금 100% draft로 시작한다.
- [x] Portfolio 보기 설정은 aggregate 배분과 분리해 저장하고 저장 실패가 배분 저장 상태를 바꾸지 않는다.
- [x] Portfolio는 Main을 수정하지 않고 Account Map과 독립된 aggregate 배분만 소유한다.
- [x] Main, Simulation과 Portfolio의 write는 소유 slice에 한정되고 Portfolio가 공유 금융 위치 registry를 갱신하지 않는다.
- [x] 구 Main·Simulation·Portfolio·Account Map·rebuild 키는 새 제품에서 fallback, migration, write 또는 delete 대상으로 사용하지 않는다.
- [x] stale workspace writer는 최신 revision을 덮어쓰지 못한다.
- [x] Portfolio는 전체 기준 배분만 제공하고 계좌·기관·보관처 관리 UI를 표시하지 않는다.
- [x] whole-workspace 백업은 format 4를 export하고 format 4/3/2/1 import를 원자적으로 검증·변환하며, invalid 입력에는 현재 raw workspace를 유지한다.
- [x] Account Map은 하나의 계좌 우선 노드 지도, 목적 배정과 계좌 간 고정/sweep 월 계획 흐름, 가역적 계좌·보관처 관리의 승인 계약을 모두 구현하며 Main 연결 결과 카드는 Phase C 전까지 기존 UI를 유지한다.
- [x] Account Map Main overlay는 map을 mounted·inert 상태로 유지하고 Main 소유 저장·취소·dirty 확인·Back/Escape·실패 input 보존·focus 복원을 제공한다. 저장 뒤에는 명시적 Main-basis 확인만 stale 상태를 해제하고 transfer를 변경하지 않는다.
- [x] Simulation과 Portfolio의 다시 설정은 해당 앱 데이터만 변경하고 Main과 다른 앱의 데이터를 보존한다.

### Phase B review closure gate

- [x] PRD, DESIGN과 Account Map 상세 명세가 현재 제품 경계와 같은 ownership을 설명한다.
- [x] 적용 지도에서 다른 계좌 연결과 add-only role 확장을 한 write로 완료한다.
- [x] Custom purpose 보관·복원과 link 비자동복구를 제공한다.
- [x] 일반적인 stale conflict·collision에서는 최신 상태를 다시 읽고 사용자 입력을 보존해 명시적으로 재적용하며, 채택한 최신 workspace에 Main이 없으면 복구나 replay 없이 Main-required로 전환한다.
- [x] 동기화된 current backup은 custom target capacity를 검증하고 이후 Main 감소로 생긴 기존 초과는 correction 가능하게 읽는다.
- [x] backup·stale(Main-null 안전 예외 포함)·custom purpose·다대다·touch·keyboard·Portfolio 보존 회귀를 통과한다.
- [x] 최신 `origin/main` 통합 후 PR diff에 승인 범위 밖 역행 변경이나 conflict가 없다.
- [x] 위 gate를 모두 통과한 같은 변경에서 Account Map을 현재 지원 제품으로 승격하고 관련 미완료 항목을 함께 `[x]`로 바꾼다.

### Transition

- [x] Simulation의 승인된 기능 명세와 레거시 disposition이 있다.
- [x] Portfolio의 승인된 기능 명세와 레거시 disposition이 있다.
- [x] Account Map과 shared workspace의 승인된 기능 명세와 단계별 disposition이 있다.
- [x] Portfolio의 기존 `투자 위치` UI와 shared location command 진입점을 제거하고 보존 데이터 회귀를 입증한다.
- [x] Phase B Account Map 상세 명세에서 계좌·보관처 관리와 Portfolio 비연결 경계를 승인한다.
- [x] Phase 4의 분류된 legacy runtime 삭제와 Task 8의 최종 전체 검증은 v1/v2 conversion·raw source preservation·reference search·type/unit/E2E/build·반응형 QA [evidence](../../../../superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md)와 함께 기록되어 있다.

### 계정 저장 rollout gate

2026-09-08 후속 사용자 요청에 따른 원격 main push·Pages 배포와 공개 사이트의 실제 이메일 로그인·계정 저장·두 브라우저 동기화는 완료했다. [Pages 배포 기록](../../../../superpowers/evidence/2026-09-08-supabase-pages-deployment.md)을 따른다. 2026-09-10 Google 설정과 등록한 테스트 계정의 실제 왕복·기존 UID 및 workspace 보존을 확인했다. 일반 Google 사용자 공개와 별도 운영 세션 만료 검증은 남아 있다. [Google 연결 기록](../../../../superpowers/evidence/2026-09-10-google-oauth-linking.md)을 따른다.

최신 main의 workspace v4·Account Map 계획 이체·Main overlay와의 통합은 [v4 통합 설계](../../../../superpowers/specs/2026-09-08-supabase-workspace-v4-integration-design.md)를 따른다. v4 필수 RPC와 세대가 분리된 계정 캐시를 사용하며 구 요청의 자동 재전송을 금지한다. 최초 v3 운영 적용 증거와 이후 v4 업그레이드 증거는 구분한다.

2026-09-08 최신 main UI까지 통합한 v4 코드를 운영 DB에 적용하고 실제 fixed/sweep·Main overlay·두 브라우저 동기화를 검증한 뒤 로컬 main에 병합했다. 코드·운영·최종 회귀 증거와 비차단 후속 사항은 [v4 통합 기록](../../../../superpowers/evidence/2026-09-08-supabase-workspace-v4-integration.md)을 따른다. Git push·Pages 배포·Google provider 설정은 이 작업에 포함하지 않았다.

2026-09-07 승인된 [설계](../../../../superpowers/specs/2026-09-07-supabase-account-workspace-design.md)에 따라 로그인 후 편집·저장, 계정당 workspace 하나를 구현한다. 2026-09-08 승인된 임시 이메일·비밀번호 경로는 같은 계약에 포함한다. 사용자가 직접 적용을 승인한 뒤 운영 DB migration·실제 계정 준비와 두 브라우저 저장 검증을 완료했다. 결과와 제한은 [운영 적용 기록](../../../../superpowers/evidence/2026-09-08-supabase-live-setup.md)을 따른다. mock 인증 E2E와 실제 로컬 PostgreSQL 검증은 실제 임시 계정 로그인·Google provider 왕복이나 운영 적용 증거를 대신하지 않는다. 2026-09-07 검증 기록은 당시 범위의 증거로 유지한다.

- [x] 운영 DB 사전 권한/버전 확인과 migration 적용, 실제 REST/RPC 권한·revision 검증
- [x] 임시 계정 사전 준비·실제 비밀번호 로그인·로그아웃, 독립된 두 브라우저 계정 저장·focus 최신화·새로고침 확인
- [ ] 실제 운영 세션 만료 후 재인증 확인(mock E2E와 구분)
- [x] Google provider, 정확한 callback allowlist와 공개 build 환경변수 등록
- [x] 등록한 Google 테스트 계정의 실제 왕복과 이메일 로그인 전후 동일 UID·workspace 유지 확인
- [ ] 일반 Google 사용자 공개를 위한 브랜딩 설정·앱 게시와 임시 비밀번호 교체
- [ ] 사용할 인증 경로의 실제 로그인, 운영 base 직접 진입·새로고침, 두 기기와 다중 탭 검증 후 배포

2026-09-10 지출 도우미와 workspace v5를 운영에 적용했다. v4 before-image를 보관하고 답변을 null로 추가하며 기존 다섯 금액·다른 slice·revision·시각·receipt의 정확한 보존을 확인했다. 모든 RPC는 protocol 5를 요구한다. Pages 배포와 실제 계정의 중간 답변 저장·두 브라우저 재개·합계 덮어쓰기·직접 금액 수정 후 답변 재사용을 검증했다. [v5 운영 기록](../../../../superpowers/evidence/2026-09-10-expense-assistant-production-rollout.md)을 따르며 앞의 v4 증거와 구분한다.

## 12. Future Product Direction

### 앱 확장 방향

제품 비전은 다음 질문을 차례로 연결하는 것이다.

1. 지금 내 돈은 한 달에 어떻게 나뉘는가? — Main
2. 이 투자 여력을 오래 유지하면 어떤 차이가 생기는가? — Simulation
3. 선택한 방향을 매달 무엇에 투자할 것인가? — Portfolio
4. 실제 금융 위치와 계좌 간 월 계획 흐름을 어떻게 단순하게 관리할 것인가? — Account Map

Phase C는 현재 Main의 metric 영역을 Main·Simulation·Portfolio·Account Map 연결 결과 카드로 바꾼다. Phase 4는 대체 증거와 전체 참조 검색을 거쳐 분류된 legacy runtime과 테스트를 제거했고, standalone old keys와 retired journey snapshot은 foreign record로 남긴다. Task 8의 [최종 전체 검증](../../../../superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md)은 이 상태를 통과로 기록했다. hidden trophy room은 금융 workspace와 backup에서 분리된 별도 후속 설계다.

거래별 지출 기록, 가구 병합, 과거 비교와 주거 구매력은 발견 단계의 후보다. 별도 문제 검증과 PRD 승인 전에는 구현 범위나 완료 요구사항으로 취급하지 않는다.

## 13. Success Signals

- 사용자가 초기 설정을 완료하고 적용된 월간 계획을 다시 확인한다.
- 적자와 남는 돈을 잘못 해석하지 않는다.
- whole-workspace 백업과 복구 실패가 현재 데이터를 훼손하지 않는다.
- Portfolio 배분과 Account Map의 계좌·보관처 연결 책임을 혼동하지 않는다.
- 신규 앱 작업이 레거시 route를 되살리지 않고 승인된 계약에서 시작한다.
- 문서 검토자가 현재 지원 기능을 런타임 및 테스트와 동일하게 설명한다.

## 14. Verification

- 정적·타입 검사: `npm run check`
- 전체 단위 테스트: `npm run test:unit`
- cross-app 브라우저 흐름: `npx playwright test tests/app-journey.spec.ts tests/main-react.spec.ts tests/simulation.spec.ts tests/portfolio.spec.ts --reporter=list`
- 전체 브라우저 흐름: `npm run test:e2e -- --reporter=list`
- production build: `npm run build`
- Main 브라우저 흐름: `npx playwright test tests/main-react.spec.ts`
- 앱 연결 흐름: `npx playwright test tests/app-journey.spec.ts`
- Simulation 브라우저 흐름: `npx playwright test tests/simulation.spec.ts`
- Portfolio 브라우저 흐름: `npx playwright test tests/portfolio.spec.ts`
- Account Map 지원 회귀: `npx playwright test tests/account-map.spec.ts`
- 레거시 제거 시: runtime import, route, selector, storage key, compatibility path와 test reference 검색 및 관련 전체 회귀
