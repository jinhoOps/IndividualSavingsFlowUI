# ISF · Individual Savings Flow

월 수입을 지출·저축·투자로 나누고, 미래 자산과 투자 비중을 이어서 계획하는 웹 앱입니다.

**[앱 열기 →](https://jinhoops.github.io/IndividualSavingsFlowUI/)**

현재 테스트 운영 중이며, 등록된 Google 테스트 계정 또는 사전 발급된 이메일 계정으로 이용할 수 있습니다. 앱 내 회원가입은 제공하지 않습니다.

## 이렇게 사용해요

### 1. Main — 이번 달 돈 배분하기

월 실수령액, 주거비, 생활비, 저축액, 투자액을 입력합니다. 지출·저축·투자의 비중과 남는 돈을 함께 확인하고, 금액을 눌러 수정할 수 있습니다.

- 지출이 막막하면 **항목별로 계산**에서 고정비·변동비 13개 항목을 정리합니다. 입력한 답변은 다음에도 이어서 사용할 수 있습니다.
- 남는 돈은 **저축·투자에 나누기**로 전부 또는 일부를 배분합니다.
- 설정 중 나가더라도 저장된 단계부터 이어갈 수 있습니다.

### 2. Simulation — 이 계획을 오래 유지하면?

Main의 월 저축·투자에 시작 자산, 기간, 기대수익률을 더해 자산 변화를 살펴봅니다. 전부 저축했을 때와 비교하고, 그래프에서 시점별 금액을 확인할 수 있습니다.

그래프 아래 **조건 편집**에서 목표 금액과 가정을 바꾸거나 명목·실질 금액을 전환합니다. 결과 아래로 더 내려가면 선택한 기대수익률에 연결된 Portfolio 샘플을 볼 수 있습니다.

### 3. Portfolio — 매달 무엇에 얼마나 투자할지

Main에서 정한 월 투자금을 최대 10개 투자 대상과 현금으로 나눕니다. 샘플로 시작하거나 직접 대상을 추가하고, 각 금액에 따른 비중을 확인한 뒤 적용합니다.

결과는 비율 중심으로 표시됩니다. 톱니 메뉴에서 금액 표시와 정렬을 바꿀 수 있습니다. 편집 창은 모바일에서 아래로부터 열리고, 넓은 화면에서는 중앙에 열립니다.

세 화면은 앱 아이콘으로 오갈 수 있습니다. 월 수입·지출·저축·투자 금액은 Main에서 수정하며, Simulation과 Portfolio는 그 금액을 이어받습니다.

## 결과를 이미지로 저장하고 공유하기

세 앱의 결과를 적용한 뒤 Portfolio 아래의 **저장하기** 또는 **공유하기**를 누릅니다.

- 월간 배분·미래 자산·투자 비중을 **3:4 세로형 PNG** 한 장으로 미리 보고 저장합니다.
- 이미지에 금액을 포함할지 선택할 수 있습니다. 이 선택은 내 계획을 바꾸지 않습니다.
- 공유 링크는 로그인 없이 열 수 있고, **기본 48시간** 동안 유효합니다. 정확한 만료 시각은 링크를 만들 때 표시됩니다.
- 공유되는 이미지는 만든 시점의 결과입니다. 이후 계획을 수정해도 기존 링크의 이미지는 바뀌지 않습니다.
- 링크를 만들 수 없는 경우에도 이미지를 기기에 저장할 수 있습니다.

## 저장과 기기 이용

계획은 로그인한 계정에 저장되어 다른 기기에서도 이어서 사용할 수 있습니다. 저장에 실패하거나 다른 기기에서 먼저 수정한 경우에는 현재 입력을 유지하고 복구 방법을 안내합니다.

오프라인에서는 마지막으로 불러온 계획을 읽기 전용으로 볼 수 있습니다. 계정 정보와 저장 상태는 톱니 메뉴에서 확인합니다.

시뮬레이션과 샘플은 입력한 가정을 비교하기 위한 계획 도구입니다. 백테스트 결과나 수익률 보장이 아니며, 은행·증권 계좌 연결, 실시간 시세와 실제 매매 기능은 제공하지 않습니다.

## 개발·운영 참고

<details>
<summary>개발 의도와 제품 원칙</summary>

월간 계획 → 장기 변화 → 투자 배분을 같은 금액 기준으로 이어서 살펴볼 수 있도록 만들었습니다.

- **결과 먼저:** 현재 상태를 숫자와 도표로 보여주고, 필요한 때 편집기를 엽니다.
- **입력 책임 구분:** 다섯 월간 금액과 지출 도우미 답변은 Main이 관리합니다. Simulation과 Portfolio는 자신의 조건·배분만 수정합니다.
- **초안과 적용 구분:** 편집 중인 값과 결과에 적용한 계획을 구분합니다. 서버 저장이 확정된 초안은 페이지 이탈을 막지 않습니다.
- **같은 편집 경험:** 모바일 바텀시트와 웹 중앙 모달이 제목·본문·상태·하단 버튼 배치, 닫기와 초점 복귀 규칙을 공유합니다.
- **한국어 금액 표현:** 화면에서는 만 원·억 원 단위로 읽고 내부 계산과 저장은 원 단위를 유지합니다.

세부 요구사항은 [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), UI·접근성 기준은 [DESIGN](DESIGN.md)을 따릅니다.

</details>

<details>
<summary>로컬 실행과 검증 명령</summary>

Node.js 22 이상과 npm을 사용합니다.

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 Supabase URL과 공개 publishable key를 설정한 뒤 실행합니다. DB 비밀번호·service-role/secret key·로그인 비밀번호는 이 파일이나 정적 빌드에 넣지 않습니다. 연결 설정이 없으면 제품 진입과 production build가 차단됩니다.

```bash
npm run dev
```

| 목적 | 명령 |
| --- | --- |
| 타입 검사 | `npm run check` |
| CI 검사·단위 테스트 | `npm run check:ci` |
| 전체 E2E | `npm run test:e2e -- --reporter=list` |
| Main 회귀 | `npx playwright test tests/main-react.spec.ts` |
| 앱 이동·계정 회귀 | `npx playwright test tests/app-journey.spec.ts tests/account-workspace.spec.ts --reporter=list` |
| 프로덕션 빌드 | `npm run build` |

계정 흐름은 Playwright `--project=cloud`, 로컬 데이터 호환성과 제품 회귀는 테스트 전용 entry의 `--project=chromium`으로 검증합니다. Production entry에는 인증 우회가 없습니다.

Docker 실행 후 `node scripts/test-workspace-db.mjs`로 DB 권한·트랜잭션을 검증할 수 있습니다. 이 명령은 운영 DB에 접속하지 않습니다. Node 25 이상에서 Web Storage와 jsdom이 충돌하면 단위 테스트에 `NODE_OPTIONS=--no-experimental-webstorage`를 지정합니다.

인증·callback 등록과 운영 적용은 [Supabase 운영 안내](docs/supabase-account-setup.md), 변경별 필수 검증은 [Agent Guide](AGENTS.md)를 따릅니다.

</details>

<details>
<summary>구현 구조·데이터 보존·이미지 운영</summary>

Vite 기반 정적 멀티페이지 앱이며 React, TypeScript, Tailwind CSS, Anime.js를 사용합니다. Vite PWA가 매니페스트와 배포 서비스워커를 관리합니다.

### 계정과 저장

- Supabase 계정당 하나의 JSONB workspace(schema v5)를 사용합니다. RLS로 계정을 격리하고 revision 검사·mutation receipt로 동시 저장과 중복 재시도를 보호합니다.
- 각 앱은 자신의 slice만 저장합니다. 앱 이동은 URL 탐색이며 Simulation·Portfolio는 최신 Main을 읽기 전용으로 참조합니다.
- 서버 workspace가 원본입니다. 브라우저는 계정별 마지막 snapshot과 미전송 입력을 복구용으로 보관합니다. 보기 설정은 금융 workspace와 별도로 저장합니다.
- 브라우저 이전은 `isf-workspace-v5` → v4 → v3 → 유효한 retired v1/v2 순으로 후보를 읽습니다. 존재하지만 잘못된 최신 원본에서 과거 버전으로 우회하지 않으며 원본을 변경·삭제하지 않습니다.
- 계정 캐시는 `isf-account-workspace-v3`입니다. 구 캐시의 미전송 요청은 자동 재전송하지 않고 복구 원문으로 보관합니다.
- 일반 메뉴에는 수동 백업 기능이 없습니다. 초기 이전·오류 복구용 backup format 4/workspace v5와 구 format 3/2/1의 검증·변환은 유지하며, 모든 slice와 참조 검증 후 한 번에 복원합니다.

### 지원 종료 기능의 호환성

Account Map UI는 제거됐고 구 URL은 Main으로 연결됩니다. `workspace.accountMap`·`workspace.locations`, schema v5·서버 protocol 5, DB migration·RPC와 백업·복구 호환성은 보존합니다. 현재 앱의 저장으로 보존 데이터를 변경하지 않습니다. [Account Map 제거 설계](docs/superpowers/specs/2026-09-15-account-map-retirement-design.md)를 따릅니다.

과거 runtime과 저장 bridge의 제거 근거는 [필수 스펙·Git 이력 안내](docs/superpowers/README.md)에서 조회할 수 있습니다. 과거 기능은 신규 제품의 구현 기준으로 사용하지 않습니다.

### 결과 이미지 운영

기기 저장은 로컬 PNG 다운로드입니다. 공유는 사용자가 확인한 1080×1440 PNG만 private Storage에 업로드하며 원본 workspace를 공개하지 않습니다.

신규 파일 최대 1MB, 전체 예약 400MB, 기본 보관 48시간, 정리 주기 5분을 적용합니다. 운영 정책은 새 링크에 한해 24시간으로 변경할 수 있으며 기존 만료 시각은 유지합니다. 실제 파일 삭제 확인 후에만 용량을 반환합니다.

2026-09-22 DB·함수·Cron 적용과 자동 정리 실행을 확인했습니다. 실제 48시간 경과 관찰을 포함한 검증 범위·미완료 항목은 [운영 기록](docs/superpowers/evidence/2026-09-22-result-card-storage-budget.md), 변경·장애 대응은 [운영 안내](docs/supabase-account-setup.md)를 따릅니다.

</details>

<details>
<summary>개발 문서와 향후 검토 항목</summary>

- [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md): 제품 범위·요구사항·인수 조건
- [DESIGN](DESIGN.md): UI·반응형·접근성 계약
- [Agent Guide](AGENTS.md): 작업 경계와 검증 절차
- [최근 계획·필수 스펙·보관 기준](docs/superpowers/README.md)
- [아키텍처 결정 기록](docs/adr/)
- [Supabase 운영 안내](docs/supabase-account-setup.md)

일반 Google 사용자 공개는 후속 운영 범위입니다. 지출 알림 텍스트 입력, 가구 계획, 과거 지출 비교, 부동산 구매력 계획과 별도 trophy room은 향후 검토 항목이며 현재 제공 기능이 아닙니다. 우선순위와 승인 범위는 PRD에서 관리합니다.

</details>

## 라이선스

[MIT 기반 비상업적 사용 제한 라이선스](LICENSE)입니다. 개인·비영리 목적의 사용, 수정, 배포는 허용하며 상업적 사용은 저작권자의 사전 서면 허가가 필요합니다.
