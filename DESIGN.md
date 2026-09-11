# ISF Design Contract

## Overview

Individual Savings Flow는 복잡한 금융 계산을 접근 가능한 계정별 계획 경험으로 바꾸는 도구입니다. 시각적 기반은 종이 같은 **ISF Pearl** 캔버스와 단색 테두리의 **flat editorial panel**입니다. 전통적인 스프레드시트의 긴장감은 줄이되 숫자의 정밀성과 신뢰감은 유지합니다.

이 문서의 현재 지원 UI 계약은 Main, Simulation, aggregate-first Portfolio와 account-first Account Map에 적용됩니다. Account Map 지도·계좌 흐름·Main overlay 표현은 [Account Map Planned Account Flow Design](docs/superpowers/specs/2026-09-04-account-map-planned-account-flow-design.md)을 따릅니다. 과거 레거시 화면과 superseded Account Map design의 모양이나 상호작용은 새 UI의 기준이 아닙니다.

현재 delivery boundary는 명확히 나눕니다. 현재 코드의 schema v5 단일 workspace, whole-workspace backup과 aggregate-first Portfolio, account-first Account Map이 현재 지원 기준선입니다. v4/v3는 read-only migration/rollback source이며 v5 운영 DB 적용·배포와 실제 계정 검증을 완료했습니다. Main 연결 결과 카드는 Phase C 범위이며, Phase 4 legacy retirement의 [최종 전체 검증](docs/superpowers/evidence/2026-09-02-phase4-legacy-test-disposition.md)은 통과로 기록되어 있습니다. Portfolio의 `투자 위치` UI와 shared location command 진입점은 제거되었으며 보존 데이터만 migration fixture 계약으로 남습니다.

## Experience Principles

1. **Discoverability**: 앱 런처와 명확한 섹션 제목으로 현재 위치와 다음 행동을 보여줍니다.
2. **Summary First**: 기본 화면은 세부 입력보다 현재 상태와 핵심 결과를 먼저 보여줍니다.
3. **One Small Data Contract**: Main은 월 실수령액, 주거비, 생활비, 저축과 투자만 직접 편집합니다.
4. **Explicit Feedback**: draft 변경, 적용, 취소, 오류와 저장 결과를 해당 편집 맥락에서 즉시 알립니다.
5. **Consistent Model**: 요약과 월 자금 구성은 동일한 정규화 데이터에서 만들어집니다.
6. **Safe Constraints**: 유효하지 않은 금액, 초과 배분과 저장 실패는 조용히 무시하지 않습니다.
7. **Progressive Disclosure**: 개요는 관계와 결과를 보여주고 민감하거나 복잡한 세부정보는 선택 후 공개합니다.
8. **Calm Hierarchy**: 같은 정보를 여러 카드 테두리와 제목으로 반복하지 않고, 여백은 결과와 다음 행동을 함께 읽을 수 있도록 사용합니다.
9. **Account Storage Trust**: 계정의 서버 확정 계획과 브라우저 원본·미전송 입력, whole-workspace import/export와 앱별 소유 slice를 명확히 구분합니다.

## Product-Specific Interaction Contracts

### Account access and recovery

- 로그인과 서버 조회가 끝나기 전에는 금융 화면을 표시하거나 빈 계획을 자동 생성하지 않습니다. 로그인 후 계정의 계획이 없을 때만 기존 브라우저 가져오기/새 시작을 직접 선택합니다.
- 2026-09-10 Google 연결 후 로그인과 세션 만료 재로그인에서 Google 버튼을 먼저 표시하고, 기존 이메일·비밀번호 폼을 보조 경로로 유지합니다. Google 버튼 → 이메일 → 비밀번호 → 이메일 제출 순서로 키보드 focus가 이동합니다. 임시 로그인은 실제 Supabase 인증을 사용하며 Google 인증을 완료한 것처럼 표시하지 않습니다. 회원가입이나 계정 자동 생성은 제공하지 않습니다.
- 이메일·비밀번호 입력에는 명시적 label과 적절한 autocomplete를 제공하고 비밀번호는 가려서 입력합니다. 비밀번호를 미리 채우거나 안내 문구에 공개하지 않으며, 요청 중 중복 제출을 막고 실패 시 같은 화면에서 접근 가능한 오류와 재시도를 제공합니다. 어느 로그인 경로에서도 인증 성공과 workspace 검증 전 금융 화면을 열지 않습니다.
- 내 계정에서 계정 식별 정보, 마지막 저장 시각과 필요한 경우 미전송 복구 파일을 제공합니다. 정상 자동 저장은 상시 성공 배너로 알리지 않습니다.
- 계정 식별 정보·마지막 저장·브라우저 계획 교체·미전송 복구·로그아웃은 네 앱의 기존 톱니바퀴 관리 메뉴 하단 `계정` 영역에 모읍니다. 별도 상단 `내 계정` 버튼은 두지 않습니다. 오프라인에도 미전송 입력 복구와 로그아웃은 가능하며 금융 입력·앱별 변경 행동은 잠급니다. 오류·충돌·오프라인 알림은 메뉴 밖에서도 보이게 유지합니다.
- 충돌 때 현재 입력을 보존하고 최신 계획 채택 또는 명시적 재적용을 제공합니다. 전체 복원은 대상 계정·현재/복원 요약을 확인하며 충돌 후에도 재확인합니다. Account Map의 Main-null 예외는 유지합니다.
- 오프라인에는 마지막 계정 계획을 읽기 전용으로 표시하고 만료 세션에서는 화면을 잠급니다. 재로그인 후 복구 입력을 자동 서버 저장하지 않습니다.
- 로그아웃 시 미전송 입력이 있으면 복구 파일 보관 또는 명시적 폐기를 선택합니다. 미전송 입력은 서버에 저장된 계획과 구분합니다.
- 로그인·이전·계정 메뉴·충돌 안내는 390px, 768px와 desktop에서 overflow 없이 표시하고 조작 영역 44px, 키보드 focus와 접근 가능한 이름을 유지합니다. 전체 교체·폐기 확인은 브라우저 기본 확인창을 사용합니다.

### Main

- 브랜드 장면은 새로운 앱 실행 탭의 첫 진입과 Main `처음부터 다시` 확인 후 재시작·초기화 진입에서만 재생한다. 같은 실행 중 앱 이동·새로고침·로그인 완료·설정 재개에서는 큰 로고 화면 자체를 표시하지 않는다. 초기 인증/조회는 시작 장면과 병렬로 진행하되 장면 수명과 연결하지 않는다. 조회를 기다리는 완성 로고는 없으며, 로고 없는 상태 문구도 400ms 지연 후에만 표시한다. [브랜드 진입 설계](docs/superpowers/specs/2026-09-11-account-loading-brand-motion-design.md)를 따른다.
- setup reveal이 진행되지 않아도 1/6 진행 action과 6/6 조립 시각화는 final state로 복구된다. review 조립의 강조와 읽기 폭은 유지하며 [Main setup 모션 복구 설계](docs/superpowers/specs/2026-08-14-main-setup-viewport-containment-design.md)의 setup 계약을 따른다.
- 정적 브랜드 아이콘과 시작 장면 모션은 세 상승 막대와 다섯 꼭짓점의 비보장 추세선을 같은 geometry로 공유한다. 추세선은 화살표 대신 마지막 원형 점으로 끝난다.
- 기본 화면은 월 수입, 생활비, 저축, 투자와 순현금흐름을 우선 보여줍니다.
- Main은 다섯 월간 금액과 지출 도우미의 보조 답변을 소유합니다. 승인된 13개 질문 외의 계좌·사용자 정의 카테고리 관리는 제공하지 않습니다.
- dashboard 편집기를 열거나 탐색하는 것만으로 dirty 상태를 만들지 않습니다.
- 실제 draft 변경이 있을 때 Apply Bar가 나타납니다.
- `취소`와 `적용`은 현재 draft와 적용된 계획의 차이를 명확히 처리합니다.
- 요약과 월 자금 구성은 적용된 데이터만 반영합니다.
- [가로 배분 요약과 하단 탐색 설계](docs/superpowers/specs/2026-09-11-main-allocation-discovery-design.md)에 따라 Main 월 자금 구성은 왼쪽의 월수입 대비 저축·투자 합계 %, 오른쪽의 저축:투자 비율, 가로 배분 막대, 네 금액 행을 하나의 요약 표면에 모읍니다. 도넛과 `자세히 보기` 버튼·펼침 영역·중복 표는 제거합니다. 월수입 금액은 요약과 그래프 접근성 설명에 직접 표시하지 않습니다. 저축:투자 비율은 두 금액의 합계를 100으로 정규화하며 모두 0원이면 미설정으로 표시합니다. 항목별 금액과 비율은 처음부터 보입니다.
- 막대와 금액 행 순서는 `지출 → 저축 → 투자 → 여윳돈`입니다. 막대는 32px 높이로 양 끝만 둥글게 하고 실제 금액 비례를 유지합니다. 지출은 따뜻한 색상, 저축·투자는 구분되는 차가운 색상, 여윳돈은 옅은 중립색을 사용합니다. 작은 항목의 폭을 인위적으로 키우지 않고 0원 항목도 금액 행에서 확인·편집합니다.
- 주거·생활비 상세와 음수·초과 문구는 해당 금액 행에서 읽습니다. 명칭·비율의 hover·focus·선택은 대응하는 막대 구간을 강조하며 숫자를 숨기거나 tooltip을 요구하지 않습니다. 저축·투자 금액은 같은 월 금액 편집기를 열어 해당 입력란에 초점을 연결하고 닫으면 진입 금액으로 초점을 돌려줍니다. 지출 금액은 `항목별로 계산` 도우미, 남는 돈 금액은 `저축·투자에 나누기` 도우미를 엽니다. 모든 조작 영역은 44px 이상입니다.
- 적자에서는 전체 배분을 하나의 축척으로 화면 안에 표시하고 `월수입 100%` 기준선과 초과 금액을 제공합니다. 마지막 항목을 잘라 숨기거나 실제 월수입 대비 비율을 100%로 재정규화하지 않습니다. 수입 0원은 비율 대신 안내를 표시합니다. reduced-motion에서는 전환을 생략합니다.
- 다섯 금액 편집은 공통 `월 금액 편집`으로도 엽니다. 767px 이하는 하단 고정 바, 768px 이상은 요약 카드 하단 버튼입니다. 바는 탭·키보드 진입점이며 드래그 동작은 없습니다.
- Simulation 진입점은 기본 화면에서 시각적으로 숨깁니다. 페이지 끝에 도착한 뒤 새로 시작한 아래 스크롤 또는 위쪽 스와이프로 `이 계획을 계속하면?`과 `미래 성장 보기`를 드러냅니다. 노출만으로 이동하지 않으며 버튼 활성화로만 URL 탐색합니다. 키보드 Tab으로 진입점에 도달하면 즉시 드러내고, 모바일 고정 편집 바에 가리지 않습니다. 편집기·모달·내부 스크롤 중에는 탐색 제스처를 무시합니다. 기존 런처 이동은 유지합니다.
- Main 소유 편집기는 제목·닫기·설명 뒤에 다섯 금액을 label–input 행으로 표시합니다. 단위는 입력 오른쪽에 두고, 빠른 금액 조정은 focus된 행에서만 펼칩니다. 오류는 해당 행 아래에 연결합니다. 모바일은 bottom sheet, 768px 이상은 읽을 수 있는 너비의 side panel을 유지합니다.
- 편집 footer는 상태 문구 아래 `취소`·`적용`을 한 줄로 배치합니다. 변경 전 적용 비활성, 저장 중 잠금, 실패 재시도와 draft 보존 동작은 유지합니다. Main과 Account Map에서 여는 Main 소유 편집기에 같은 규칙을 적용합니다.

### 지출 계산 도우미

- 한 번에 한 질문과 월/연 기준 금액을 입력하고 고정비 → 변동비 순서와 월평균 소계를 보여줍니다. 입력 아래 `-50만`, `-10만`, `+10만`, `+50만` 빠른 조정을 한 줄로 제공합니다. 선택한 월/연 원금액을 조정하며 0원 아래로 내려가지 않습니다. 빈 답변과 `없어요`의 0원을 구분합니다.
- 완료 전에는 항목 내역과 주거·생활·월 지출 합계를 보여줍니다. 내역의 금액에서 단일 답변으로 바로 이동하며 재방문에도 내역과 질문 단계를 기억합니다.
- `이 금액으로 반영`은 직접 입력했던 주거비·생활비를 항목 합계로 대체합니다. 중간 답변 저장은 적용 금액을 바꾸지 않습니다. 의미와 저장 계약은 [지출 도우미 설계](docs/superpowers/specs/2026-09-10-main-expense-assistant-design.md)를 따릅니다.
- 모바일 bottom sheet와 768px 이상 우측 modal panel은 배경 비활성화·focus trap·Escape·진입 금액으로 focus 복원을 제공합니다. footer 합계와 행동은 고정하고 질문/13개 내역만 내부 스크롤합니다. 저장 결과 불명과 충돌은 패널 내부에서 재시도할 수 있습니다.

### 남는 돈 분배 도우미

- 남는 돈 금액을 누르면 저축·투자에 더 넣을지 묻습니다. 전부 저축·전부 투자·반씩 나누기와 직접 원 단위 입력을 제공하고, 처음에는 추가 금액을 0원으로 둡니다.
- 현재 금액·반영 후 금액·나눈 뒤 남는 돈을 표시하며 일부를 남겨둘 수 있습니다. 남는 돈을 초과한 입력은 적용하지 않습니다. `이렇게 나누기`는 기존 월 저축·투자에 추가하고 다른 값과 지출 답변을 보존합니다.
- 0원·적자는 현재 배분 상태만 설명하며 추가 금액을 받지 않습니다. 모바일 sheet와 desktop panel은 지출 도우미의 overlay·키보드·focus 계약을 따릅니다.
- 상세 저장·오류·취소 계약은 [남는 돈 분배 설계](docs/superpowers/specs/2026-09-10-main-remaining-allocation-design.md)를 따릅니다.

### Current Journey

- 앱 런처는 `자금 흐름 (Main)`, `미래 성장 (Simulation)`, `투자 배분 (Portfolio)`, `계좌 연결 (Account Map)`을 각각 집, 상승 그래프, 분할 도넛, 펼친 통장 아이콘으로 표시합니다.
- 현재 위치는 아이콘 아래 선과 `aria-current`로 표시합니다.
- 앱 런처와 CTA는 URL 탐색만 수행하며 데이터를 전달하거나 저장하지 않습니다.
- Simulation과 Portfolio는 현재 v5 workspace의 Main applied를 각자의 읽기 전용 adapter로 읽고 write-back하지 않습니다. 브라우저 이전 후보는 v5 → v4 → v3 → retired v1/v2 우선순위로 읽고, 존재하지만 invalid인 최신 원본에서 이전 버전으로 fallback하지 않습니다.
- Simulation과 Portfolio의 Main read는 읽기 전용입니다. Portfolio는 자기 slice만, Account Map은 자기 slice와 공유 금융 위치 registry만 갱신합니다. 성공한 write마다 monotonic revision을 증가시킵니다.

### Simulation

- 최초 설정은 시작 자산 → 조건부 목표 금액(시작 자산 2억 원 이상일 때) → 기대 연 수익률을 한 가지 결정씩 안내하고, 재방문은 저장된 목표가 있는 결과를 먼저 보여줍니다. 결과 핵심 문장은 사용자가 고른 그래프 기간과 독립적으로 목표에 처음 도달하는 시점을 최대 30년까지 찾습니다.
- 결과는 목표 도달 핵심 문장과 조건 한 줄 뒤에 하나의 자산 변화 패널을 제공합니다. 패널은 `N년 동안의 자산 변화` 제목(0년은 `현재 자산`), 명목·실질과 해설, 그래프, 기간·수익률 조작, 낮은 강조의 비교값 순서로 읽힙니다. 그래프·조작·비교에 중첩 카드 외곽선을 만들지 않습니다. 비교 배율은 `넣은 돈 대비 N배`로 표시합니다.
- 새 초안 기본 기간은 5년이고 저장된 기간은 유지합니다. 기간은 0~30년 슬라이더와 숫자 입력을 함께 제공하고 직접 기대수익률은 ±0.25%p 조작을 제공합니다. `연 기대수익률` 옆에 작고 낮은 강조의 `(투자)`를 표시해 적용 대상을 구분합니다.
- 그래프는 기본 상태를 절제하고 pointer·keyboard 탐색에서는 선택 기간과 현재 계획·전부 저축·납입원금·저축·투자 잔액을 상세 카드로 보여줍니다. 3년 이하는 현재부터 매월, 4~30년은 현재와 연말 point를 제공합니다.
- 767px 이하 touch 탐색은 누른 채 기간을 이동하고 손을 뗀 뒤 선택을 유지합니다. 고정 크기 compact tooltip은 기간·현재 계획 총액·누적 납입원금만 한 줄로 보여주며 그래프 밖 touch나 scroll에서 닫힙니다.
- 그래프 축 레이블은 SVG 축소 비율과 무관하게 실제 화면에서 최소 12px로 읽혀야 하며, 양 끝 기간 레이블이 잘리지 않아야 합니다.
- 그래프 tooltip은 닫기 버튼을 두지 않으며 `Escape`와 그래프 밖 pointer로 닫힙니다.
- 한국식 정수 금액은 tooltip과 비교 영역에서 임의 글자 단위로 줄바꿈하거나 잘라내지 않습니다.
- `목표와 가정`의 현재 모아둔 돈은 `-5천만`, `-1천만`, `+1천만`, `+5천만`으로 빠르게 조정합니다. 최초 설정의 `±100만·±1000만` 단위는 유지합니다.
- 하단 `목표와 가정`은 기본으로 접고 현재 목표·시작 자산을 요약합니다. 펼치면 목표·시작 자산·금리·물가를 한 번에 조정하며 중첩된 펼침 UI는 만들지 않습니다. 목표는 1천만 원 단위 직접 입력과 `−5천만 / −1천만 / +1천만 / +5천만`으로 조정하고 기본 목표로 복원합니다. 명목·실질은 자산 변화 패널 제목 옆에 짧은 해설과 함께 항상 보입니다. 금액 입력은 모바일 한 열·768px 이상 두 열이며 조작 영역은 최소 44px입니다.
- 정상 자동 저장 성공은 상시 표시하지 않습니다. 저장이 지연될 때만 진행 상태를 알리고 실패와 복구 필요 상태는 명확한 다음 행동과 함께 강조합니다. 재설정은 앱 런처의 관리 메뉴 안에서 확인합니다.
- 일반 결과·조작 영역은 공통 `Flat Panel`과 버튼 규격을 사용하고, 그래프 선·면·tooltip처럼 정보 해석에 필요한 시각 요소만 Simulation 고유 표현을 유지합니다.

### Portfolio

- 최초 진입은 `시작 → 배분 → 검토`의 세 단계로 한 가지 작업만 보여주며, 현금 100%도 유효한 계획입니다. 적용 계획이 있으면 결과로 바로 진입합니다.
- 결과 화면은 금액보다 배분 비율을 먼저 보여줍니다. 상단 핵심 요약은 `안정 N%`, 보조 문구는 현재 표시 순서에서 비중이 가장 큰 항목의 이름과 비율을 설명합니다.
- 기본 상태에서는 총액과 항목별 원화 금액을 숨깁니다. 사용자가 관리 메뉴에서 `금액 보기`를 켜도 비율을 주 정보로 유지하며 총액과 항목별 금액을 보조 정보로 표시합니다.
- 배분 항목은 도넛과 표를 중복하지 않고, 이름·비율·비례 막대로 빠르게 비교할 수 있는 목록 하나로 제공합니다. 각 행의 의미와 비율은 pointer·touch·keyboard에서 동등하게 확인할 수 있어야 합니다.
- 결과 화면의 배분 편집 진입점은 연필 아이콘 하나로 절제하되 44×44px 선택 영역과 접근 가능한 이름을 유지합니다. 지속적인 `저장됨` 문구는 표시하지 않고 저장 오류는 편집 맥락에서 분명히 알립니다.
- 정렬은 관리 메뉴에서 `비율순`과 `입력순`을 전환하며 기본값은 `비율순`입니다. 같은 비율이면 현재 표시 순서를 유지합니다.
- 편집 화면에서 각 항목을 `성장` 또는 `안정`으로 분류합니다. 현금은 항상 `안정`이며 금현물·채권·금 또는 금·채권 관련 ETF 이름은 `안정`을 자동 추천하되 사용자가 바꿀 수 있고 사용자 지정이 자동 추천보다 우선합니다.
- 배분 단계는 월 투자금과 성장·안정 비율을 입력보다 먼저 요약합니다. 사용자는 원화 금액만 입력하고 비율은 전체 투자금 기준으로 자동 계산합니다. 분류는 이름 기반 자동 추천을 기본으로 하며 편집 상태에서 이름 오른쪽의 단일 성장·안정 segment를 눌러 전환합니다. 완성된 대상과 현금은 한 줄 요약을 기본으로 하고, 전체 폭 `+` 블록 또는 기존 대상 행을 선택하면 추가·수정 공통 modal bottom sheet가 아래에서 올라와 배경 목록을 덮습니다. sheet에는 이름·분류·금액과 `취소 / 완료`만 두며, 변경 후 backdrop·Escape·취소에는 폐기 확인을 요구합니다. 저장 전 확인 단계는 성장·안정 합계와 각 대상·현금의 금액 및 계산된 비율을 함께 보여줍니다.
- `배분 수정`은 결과와 시각적으로 분리된 집중 화면을 엽니다. 768px 이하는 하단 sheet, 769px 이상은 우측 panel이며 결과 영역은 편집 중 비활성화합니다.
- 변경 전에는 적용 action을 숨기고 첫 변경 뒤에만 취소·적용을 제공합니다.
- 투자금 0원은 기존 계획을 보존하고 Main 투자금 편집으로 안내합니다.
- 현재 배분 편집과 결과는 항상 `전체 기준`이 우선입니다.
- 최초 설정, 결과와 배분 수정 어디에서도 계좌·기관·보관처 또는 공유 금융 위치 관리 UI를 표시하지 않습니다.
- retired location-scoped Portfolio 데이터는 conversion에서 현재 state로 보존하지 않으며, Portfolio가 이를 만들거나 편집할 수 있는 것처럼 표현하지 않습니다.

### Account Map

- 계좌·기관·보관처의 생성, 이름 변경과 보관을 Account Map이 소유합니다.
- Portfolio 투자 대상과 계좌·보관처의 연결은 별도 승인된 상세 명세가 있을 때만 제공하며, Account Map command는 Main에 write-back하지 않습니다.
- 완료 화면은 주 수입 계좌를 먼저 두는 하나의 account-first 계획 흐름 관계도를 주요 시각 요소로 사용합니다. 목적과 계좌·보관처의 배정, 계좌 간 고정 이체와 `남은 금액 전부` 규칙은 실제 잔액·거래·계좌 간 실행 이체가 아닙니다.
- 기본 상태는 전체 계좌 토폴로지, 목적 기준 금액과 계획상 부족·미배정을 보여줍니다. 관계 유형, rule, excess와 선택 상태는 색상과 짧은 텍스트를 함께 사용해 색상만으로 구분하지 않습니다. zero sweep도 숨기지 않습니다.
- 계좌의 첫 pointer·touch·keyboard 선택은 도달 가능한 상·하류 흐름과 목적, 고정 금액 또는 sweep 규칙을 정적 최종 상태로 공개하고 `계좌 정보 편집`·`연결 추가`·`흐름 편집`을 명시한다. 두 번째 선택을 요구하지 않으며 reduced-motion에서는 즉시 최종 상태를 보입니다.
- `계좌 정보 편집`은 선택한 계좌의 편집 양식을 바로 열며, 닫기·취소·저장 뒤에는 진입 버튼으로 focus를 돌려줍니다. 계좌 보관은 편집 맥락에서도 접근할 수 있고 영향을 먼저 확인합니다.
- 자기 이체, 중복 active source/target, cycle, 없는/보관된 endpoint, 한 출발 계좌의 복수 sweep은 적용 전에 차단합니다. 계획상 부족은 경고이며 저장 corruption이 아닙니다.
- Account Map에서 Main 금액 수정을 요청하면 같은 URL의 journey overlay가 Main 소유 editor를 mounted map 위에 표시한다. 배경 map은 blur·`inert`가 되고, overlay는 labelled modal, focus trap, Escape/Back close와 trigger focus 복원을 제공한다. dirty Escape/Back은 discard 확인을 거치고, 실패·conflict에서는 input을 유지한다.
- 성공한 Main 저장 뒤 Map은 최신 workspace를 다시 읽고, `sourceMainUpdatedAt !== main.updatedAt`이면 하나의 `확인 필요` 상태를 announcement로 표시한다. `현재 Main 기준으로 확인`은 명시 command로 purpose remainder만 재계산하고 fixed/sweep transfer를 바꾸지 않는다. fixed purpose allocation 초과면 오류를 설명하고 write하지 않는다.
- 계좌·보관처 보관은 영향을 먼저 보여주고 purpose·transfer 관계를 중지하며, 복원은 관계별 선택을 제공한다. stale conflict·collision은 입력을 유지한 명시 재적용을 요구한다. Main이 없으면 replay 없이 Main-required로 전환한다.
- screen-reader용 선형 표는 Main anchor, 계좌와 ordered transfer, 목적 anchor를 포함해 지도와 같은 결정적 reading order를 제공합니다. 모바일 요약은 관계도를 첫 viewport 밖으로 밀어내지 않아야 합니다.

## Colors

### Brand and Accent

- **ISF Sunset / Primary** (`var(--tone-primary)`, `#ea5b2a`): 시각화와 장식용 강조
- **ISF Sunset / Action** (`var(--tone-action)`, `#c24116`): 흰색 레이블의 주요 CTA와 작은 강조 텍스트
- **Action Hover** (`var(--tone-action-hover)`, `#a93612`): 주요 CTA의 hover 상태
- **ISF Deep Sea / Accent** (`var(--tone-accent)`, `#0f766e`): 긍정 상태, 수입과 보조 강조

### Surface and Background

- **ISF Pearl / Canvas** (`var(--bg)`, `#f8f6f1`): 앱 기본 배경
- **Flat Panel** (`var(--panel)`, `#ffffff`): 카드, 입력 그룹과 주요 콘텐츠 표면
- **Line** (`var(--line)`): 패널 경계와 구조 구분

일반 텍스트와 버튼 레이블은 배경 대비 4.5:1 이상을 유지하고 hover·focus 상태도 확인합니다. 밝은 브랜드 색상을 작은 글자의 색이나 흰색 버튼 레이블의 배경으로 직접 사용하지 않습니다.

상태 색상은 텍스트, 아이콘 또는 레이블과 함께 사용합니다. 색상만으로 오류·경고·성공을 전달하지 않습니다.

## Typography

### Font Family

- **Gowun Batang**: 화면 제목, 주요 섹션 제목과 핵심 숫자
- **Gowun Dodum**: 본문, 레이블, 입력, 버튼과 데이터 테이블

### Hierarchy

| Token | Size | Weight | Use |
|---|---:|---:|---|
| Display | 28–40px | Bold | 설정·복구·결과 화면 제목 |
| Result Statement | 32–48px | Bold | Simulation의 핵심 결과 문장 |
| Title Large | 24px | Bold | 주요 카드 제목 |
| Title Medium | 18px | Bold | modal 및 하위 섹션 제목 |
| Body | 16px | Regular | 기본 본문과 입력 |
| Caption | 14px | Regular | 보조 설명, 단위와 상태 |

제목 크기는 공통 `--ui-title-size`, 핵심 결과 문장은 `--ui-result-size`를 사용합니다. 설정·복구 제목도 명시적인 크기·굵기·줄 높이를 가지며 브라우저 기본 스타일에 의존하지 않습니다. 한글 제목은 어절을 유지하고 균형 있게 줄바꿈합니다.

임의의 글꼴 조합을 추가하지 않습니다. 숫자 강조에서도 의미 계층을 유지합니다.

## Money and Units

- 내부 계산과 영속화는 **원 단위**를 사용합니다.
- 사용자가 입력하는 금액 필드는 현재 화면 계약에 맞는 원화 형식을 사용하고 단위를 명시합니다.
- 요약과 읽기 화면에서는 만 원·억 원 단위를 사용해 빠르게 읽을 수 있게 합니다.
- 1억 원 미만은 백 원 단위까지 반올림해 천 원까지, 1억 원 이상은 천 원 단위까지 반올림해 억·만 원 조합으로 소수점 없이 표시합니다.
- 금액 변환과 표시는 공통 utility를 사용해 화면별 오차를 만들지 않습니다.
- 사용자 편집 금액의 허용 범위와 비정상 값은 저장 전에 검증합니다. 계산 결과인 0원 또는 음수 월 투자 가능액은 정상 journey 상태로 표시할 수 있습니다.

## Components

### App Launcher

- 상단 중앙의 작은 둥근 도크 안에 `ISF 앱` 탐색과 `앱 도구` 그룹을 모으고 짧은 간격과 세로 hairline으로 구분합니다. 도크는 아이콘 수에 맞는 폭을 사용하며 페이지와 함께 스크롤합니다. 앱 이름은 기본으로 숨기며 기존 아이콘 의미를 유지합니다. 앱 링크와 톱니는 모두 44×44px 선택 영역을 유지합니다.
- Main, Simulation, Portfolio와 Account Map을 한 줄의 아이콘으로 보여주되, 가용 폭이 부족할 때만 `더보기`에 원래 순서대로 이동합니다. 현재 앱은 항상 직접 표시하고 네 앱이 모두 들어가면 `더보기`를 렌더링하지 않습니다.
- 현재 목적지는 안정적인 아이콘 아래 선과 `aria-current`로 분명히 표시합니다.
- 옅은 청록 배경은 hover·keyboard focus·길게 누른 아이콘을 따라 180ms로 이동하고 상호작용이 끝나면 현재 앱으로 돌아옵니다. 이 미리보기는 현재 위치나 실제 URL을 바꾸지 않습니다. fine pointer에서는 아이콘만 2px 이내로 떠오르고 touch pressed에서는 아이콘만 작게 눌립니다. 선택 영역의 크기와 위치는 움직이지 않습니다.
- pointer hover와 keyboard focus는 동일한 한글·영문 툴팁을 제공하고, touch는 450ms 길게 누르면 같은 정보를 표시하되 해당 탭의 탐색과 context menu를 한 번 억제합니다.
- 톱니 팝오버는 앱별 보기 설정·다시 설정 뒤에 공통 계정 정보·로그아웃을 표시합니다. 일반 백업 내보내기·가져오기와 중복된 `앱 아이콘 안내`는 표시하지 않습니다. 초기 브라우저 이전과 오류·미전송 입력 복구 경로는 유지합니다.
- Main은 `처음부터 다시`, Simulation은 `시뮬레이션 다시 설정`, Portfolio는 금액 표시·정렬과 `투자 배분 처음부터 다시`, Account Map은 보관 항목 복원과 `월 연결 다시 만들기`를 제공합니다. 아직 지도가 없으면 상태 안내만 표시합니다. 빈 action 구역과 양 끝 구분선을 만들지 않으며, 앱 설정과 계정 항목이 모두 없을 때만 톱니를 숨깁니다.
- Main 재시작 확인은 왼쪽 `초기화`와 오른쪽 취소·다시 시작을 제공한다. 초기화는 모달을 열 때마다 카운트다운 표시 없이 2.5초간 비활성화하고 취소에 초기 focus를 둔다. 다섯 월 금액의 입력 칸을 비운 재시작 초안과 지출 도우미 전체 내역 삭제를 한 번에 저장한다. 기존 적용 계획과 다른 앱 설정은 보존한다. 기존 계획은 새 설정의 마지막 적용 때 바뀐다고 안내한다. 저장 실패 시 현재 계획과 모달을 유지한다.
- 관리 popover는 viewport 좌우 16px 안에 머물고, Escape 또는 바깥 pointer 입력으로 닫힌 뒤 톱니 버튼으로 focus를 돌려보냅니다. 파괴적 행동은 별도 확인 dialog와 내부 focus 관리를 거칩니다.
- 툴팁, `더보기`, 관리 메뉴는 Escape 또는 바깥 pointer 입력으로 닫히고 소유 trigger로 focus를 돌려보냅니다. 두 popover는 동시에 열리지 않으며 `prefers-reduced-motion`에서는 전환 효과를 제거합니다.
- 런처 링크는 URL 탐색만 수행하며 앱 간 데이터 연결 상태를 소유하거나 표시하지 않습니다.
- 주 입력이 touch인 기기(`pointer: coarse`)에서는 앱 아이콘의 선택 배경·색상·눌림 효과와 현재 위치 선을 애니메이션 없이 즉시 표시합니다. 길게 누르기 설명과 fine pointer의 기존 전환 효과는 유지합니다.
- 앱 이동은 애니메이션을 기다리지 않는 원래 링크 탐색입니다. 페이지를 건너는 모션이나 별도 탐색 저장소는 추가하지 않습니다. reduced-motion에서는 배경 이동과 아이콘 변형을 제거하고 최종 상태를 즉시 표시합니다.

### Recovery and Empty States

- 진행을 막는 상태에는 원인과 구체적인 다음 행동을 함께 제공합니다. 보존된 계획이 있으면 이를 명확히 설명합니다.
- 다른 앱에서 해결해야 하는 경우 목적지를 설명하는 공통 버튼 형태의 직접 이동 링크를 제공합니다. 주요 행동은 44px 이상의 선택 영역을 유지합니다.
- 사용자 안내에는 내부 controller·slice·write 같은 구현 용어 대신 현재 화면의 한글 목적과 수행할 행동을 사용합니다.

### Main Cashflow Editor

- 다섯 월간 값을 한 덩어리의 이해 가능한 양식으로 제공합니다.
- desktop에서는 dashboard 옆 편집 영역, mobile에서는 dialog로 같은 계약을 제공합니다.
- 오류가 있으면 해당 필드 가까이에서 수정 방법을 알려줍니다.
- mobile dialog의 focus를 내부에서 관리하고 닫힌 뒤 진입 컨트롤로 돌려보냅니다.

### Apply Bar

- Main의 draft/apply 편집 맥락에서 사용합니다.
- 단순 탐색은 Apply Bar를 만들지 않습니다.
- `취소`와 `적용` 같은 결과 중심 문구를 사용합니다.
- 모바일 safe area와 편집 내용을 가리지 않습니다.

### Toast Message

- 사용자가 명시적으로 실행한 적용·백업·복원·import 결과와 오류를 비차단 방식으로 알립니다. 정상 자동 저장 성공은 상시 toast나 상태 문구로 반복하지 않습니다.
- 해결을 위한 사용자 행동이 필요하면 구체적인 다음 단계를 포함합니다.

### 저장 이전과 복구

- 일반 톱니 메뉴는 수동 백업 내보내기·가져오기를 제공하지 않습니다. 초기 브라우저 계획 이전과 유효하지 않은 계정 저장 상태의 명시적 복구에서만 관련 파일·전체 교체 흐름을 제공합니다.
- 이전·복구 파일은 Main·Simulation·Portfolio·공유 위치와 Account Map contract를 backup format 4 envelope로 다룹니다.
- import는 모든 slice와 참조를 적용 전에 검증하고 유효하면 전체 교체 확인 뒤 한 번에 v5 workspace를 교체합니다. format 3의 v4, format 2의 v3와 format 1 retired input은 같은 read-only converter로 검증·변환하며, invalid input은 현재 raw workspace를 유지합니다.

### Button

- 금액 증감은 공통 `MoneyAdjustments`로 표시합니다. 옅은 배경·얇은 경계 안에 버튼을 한 줄로 묶고, 감소와 증가를 같은 크기로 표시합니다. 월/연 금액, 빈 값과 0원, 상한·저장 시점은 각 입력의 기존 계약을 유지합니다.
- 월/연·명목/실질 선택은 공통 `SegmentedControl`을 사용합니다. 흰 선택 면과 청록 글자로 현재 선택을 표시하고 `aria-pressed`를 유지합니다. 금액 증감에는 선택 상태를 남기지 않습니다.
- 두 컨트롤은 최소 44px 조작 영역과 14px 숫자·라벨을 사용합니다. hover·pressed·focus를 구분하고 버튼 크기를 움직이지 않습니다. reduced-motion에서는 전환을 생략합니다.

- 주요 CTA와 보조 행동의 위계를 색상, 테두리와 배치로 구분합니다.
- 누름 상태에는 `transform: scale(0.96)` 수준의 물리적 피드백을 사용할 수 있습니다.
- 텍스트 없이 의미를 알기 어려운 아이콘 버튼은 접근 가능한 이름을 제공합니다.

### Input

- 레이블과 단위를 항상 식별할 수 있어야 합니다.
- 오류는 해당 필드 가까이에 표시합니다.
- 숫자 입력은 모바일 키보드와 직접 입력을 모두 고려합니다.

## Layout

### Spacing

- 기본 단위: 4px
- 권장 간격: 4px, 8px, 14px, 24px, 32px
- 주요 카드 내부 여백: 기본 24px, 모바일에서는 정보 밀도에 맞게 축소

### Reading Width

- 일반 앱 본문은 공통 `48rem` 최대 읽기 폭과 viewport 좌우 `1rem` 가드레일을 사용한다.
- viewport 가드레일은 page-level content frame 한 곳만 소유하며 outer padding과 중첩하지 않는다.
- Main 최초·재시작 review의 조립 카드·표·시각화는 setup 표면의 `48rem` 읽기 폭 안에 머문다. 실제 적자 비율을 보여주는 막대 내부 표현만 viewport 가드레일까지 연장되고 화면 경계에서 절단될 수 있다.
- launcher와 viewport overlay는 본문 읽기 폭 규격에서 제외한다.

### Information Sequence

기본 정보 순서는 다음을 따릅니다.

1. Summary
2. Visualization
3. Controls or Detail Entry
4. Projection or Decision Support

모든 화면이 네 단계를 강제로 포함할 필요는 없지만, 세부 입력이 결과 이해보다 먼저 화면을 압도해서는 안 됩니다.

### Depth

| Level | Treatment | Use |
|---|---|---|
| Canvas | ISF Pearl, shadow 없음 | 앱 바닥 |
| Flat Panel | 흰색 배경, 단색 border | 카드, 입력 그룹, 그래프 영역 |
| Floating | 제한된 shadow와 높은 z-index | modal, contextual Pending Bar, toast |

gradient와 반투명 card를 기본 스타일로 사용하지 않습니다. 일반 요약 카드에는 floating shadow를 사용하지 않고, 하나의 시각화를 겹친 카드 테두리로 감싸지 않습니다. Main 수치 편집에는 눈에 보이는 편집 단서를 제공합니다.

## Responsive Behavior

### Required Viewports

- **390px급 모바일**: 주요 모바일 기준
- **768px 이하**: tablet 및 좁은 화면 전환 기준
- **일반 desktop**: 다중 열과 넓은 시각화

### Contracts

- 앱 본문의 상단 간격은 공통 `--ui-page-space`를 사용하고, 일반 섹션 간격은 24px을 기본으로 합니다. launcher와 overlay의 폭·좌표는 별도 계약을 유지합니다.
- 모바일에서 상단·목록 여백을 desktop보다 늘리지 않습니다. 핵심 결과와 다음 행동까지의 읽기 거리를 줄이되 긴 금액, 44px target과 시각화 크기를 보존합니다.
- 같은 제목과 설명을 연속된 표면에서 반복하지 않습니다.
- 390px에서 body의 예기치 않은 가로 overflow가 없어야 합니다.
- 390px에서 Simulation 그래프와 비교값은 보이고 tooltip은 viewport 안에 머물러야 합니다.
- 보이는 주요 버튼과 입력은 최소 44px touch target을 가져야 합니다.
- modal 콘텐츠는 viewport 안에서 스크롤되고 footer 또는 Pending Bar가 가려지지 않아야 합니다.
- 다중 열 control은 768px 이하에서 단일 열 또는 읽을 수 있는 compact layout으로 전환합니다.
- 현재 Main 월 자금 구성, Simulation 그래프와 Account Map 전체 흐름 지도는 의미를 잃도록 과도하게 축소하지 않습니다.
- Portfolio의 설정과 하단 편집 sheet는 390px에서 이름·금액·비율과 action이 패널 밖으로 넘치지 않아야 합니다.
- Account Map의 compact summary와 `확인 필요` notice는 모바일 첫 화면에서 전체 흐름 지도를 밀어내지 않아야 합니다.
- Account Map의 월 계획 흐름, focused detail, account/flow editor와 Main overlay는 390px, 768px와 desktop에서 viewport/canvas 안에 머물고 가로 overflow를 만들지 않아야 합니다.

## Accessibility

- 모든 입력은 label 또는 동등한 accessible name을 가져야 합니다.
- modal은 올바른 role, 제목 연결, focus trap과 close 뒤 trigger focus 복원이 필요합니다. Main overlay는 map background를 inert accessibility tree 밖으로 둡니다.
- field 오류와 stale 재적용 충돌은 첫 관련 control에 focus를 이동하고 오류 설명을 해당 control과 연결합니다.
- 그래프는 source, target, rule/amount와 state를 설명하는 accessible name 및 전체 흐름을 읽을 수 있는 텍스트 표를 제공합니다.
- 키보드로 주요 선택, 저장, 취소와 닫기를 수행할 수 있어야 합니다.
- 오류와 상태는 색상 외의 텍스트 또는 아이콘으로도 전달합니다.

## Do

- 공통 header, feedback, storage와 formatting utility를 먼저 확인합니다.
- Main 현재 데이터 소유권, URL-only 탐색과 상세 앱의 명시적인 workspace Main read 경계를 유지합니다.
- Workspace write는 각 앱의 소유 slice에 한정하고 Portfolio는 공유 금융 위치 registry를 갱신하지 않습니다. 어떤 writer도 stale revision을 조용히 덮어쓰면 안 됩니다.
- Main의 다섯 값 직접 편집과 승인된 지출 계산 보조 질문 외의 재무 편집 UI를 추가하지 않습니다.
- 외부 동작과 모바일 화면을 함께 검증합니다.
- CSS 수정 전후 responsive media query와 파일 구조를 확인합니다.

## Do Not

- 레거시 UI를 새 화면의 디자인 기준으로 사용하지 않습니다.
- Main에 두 번째 일반 재무 편집기를 만들지 않습니다.
- Phase C 전에 Main 연결 결과 카드를 현재 계약처럼 표시하지 않습니다.
- Portfolio에 계좌·기관·보관처 관리나 location-scoped 배분 action을 추가하지 않습니다.
- 모든 앱에 하나의 전역 Pending Bar 동작을 강제하지 않습니다.
- Account Map 수정이 Main에 자동 반영되는 것처럼 표현하지 않습니다.
- 카드에 gradient 또는 과도한 translucent effect를 사용하지 않습니다.
- Gowun Batang과 Gowun Dodum의 역할을 임의로 뒤섞지 않습니다.
- 390px와 768px 검증 없이 responsive 작업을 완료로 선언하지 않습니다.
