# Main 지출 도우미·하단 전체 편집 — Design QA

검토일: 2026-09-10. 이 절이 현재 구현의 검증 기록이다. 뒤의 두 QA는 단계별 과거 증거다.

사용자가 선택한 두 번째 목록형 시안의 단일 요약 표면·금액 정렬·밀도를 유지했다. 지출 금액은 지팡이 아이콘과 `항목별로 계산` 안내로 도우미를 열며, 다섯 금액의 직접 편집은 모바일 화면 아래 고정 바에서 올라온다. 768px 이상은 요약 카드 하단의 단일 편집 버튼을 사용한다. 바는 탭·키보드로 작동하며 드래그 제스처는 구현하지 않았다.

## 화면 증거

[선택 시안과 구현의 나란히 비교](docs/reviews/2026-09-10-main-refinement/helper-comparison-result.png)를 실제 렌더 크기로 열어 확인했다. 원본의 1206×1304 이미지를 높이 844로 비례 축소한 뒤 결과 화면을 분리했고, 구현은 390×844/DPR 1이다. 원본의 연필 제거, 소비→지출, 금액의 도우미 진입과 하단 전체 편집은 후속 사용자 지시로 바꾼 부분이다. 도넛의 중복 비율 생략과 Gowun 브랜드 서체 유지도 의도한 차이다.

| 폭 | 요약 | 도우미 질문 | 도우미 내역 | 전체 편집 |
| --- | --- | --- | --- | --- |
| 390px | [화면](docs/reviews/2026-09-10-main-refinement/helper-result-390.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-question-390.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-review-390.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-editor-390.png) |
| 768px | [화면](docs/reviews/2026-09-10-main-refinement/helper-result-768.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-question-768.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-review-768.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-editor-768.png) |
| 1280px | [화면](docs/reviews/2026-09-10-main-refinement/helper-result-1280.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-question-1280.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-review-1280.png) | [화면](docs/reviews/2026-09-10-main-refinement/helper-editor-1280.png) |

위 12개 화면과 [연간 답변](docs/reviews/2026-09-10-main-refinement/helper-annual-390.png), [내역 맨 아래](docs/reviews/2026-09-10-main-refinement/helper-review-bottom-390.png), [완료 결과](docs/reviews/2026-09-10-main-refinement/helper-completed-390.png)를 직접 확인했다. Orca UI에서 초기 설정과 13개 질문을 입력해 180만 원 추정치를 주거 90만+생활 60만=150만 원으로 대체했다. 연간 답변·내역 하단 추가 캡처는 독립 Playwright 브라우저를 사용했다.

[측정 기록](docs/reviews/2026-09-10-main-refinement/helper-viewport-checks.json): 모든 대상 폭에서 가로 overflow 없음. 질문과 내역의 footer는 viewport 안에 고정되며 마지막 항목은 내부 스크롤로 접근한다. 도우미 control과 일반 action 높이는 최소 44px, 내역 행은 48px다. 마지막 항목과 고정 합계가 동시에 보이는 상태도 확인했다. 추가 Playwright 캡처의 page error는 0건이다.

모바일 요약에서 하단 편집 바는 항상 보이고 Simulation CTA는 아래로 스크롤하면 이어진다. 데스크톱은 48rem 읽기 폭을 유지한다. 새 도우미는 기존 Main 편집의 색상·서체·footer 규격을 사용하며 모바일은 질문 한 개, 완료 화면은 항목 목록으로 정보량을 제한한다. 현재 요청 범위에서 남은 P0/P1/P2 시각·상호작용 차이는 발견하지 못했다.

## 흐름과 저장 검증

- 저장한 질문 재개, 답변 원금액/월·연 기준 복원, 재로그인 뒤 미전송 답변 복구, 다른 브라우저에서 완료 내역 조회를 검증했다.
- 중간 저장은 Main applied를 유지하고, 완료는 서버 합계로 주거·생활비를 대체한다. 직접 금액 변경 후에도 내역을 기억하며 재완료는 다시 합계로 덮어쓴다. 수입·저축·투자와 다른 slice를 보존한다.
- 응답 유실과 동시 변경은 패널 내부에서 기존 계정 재시도·명시 재적용을 사용한다. 같은 mutation의 중복 합산과 revision 증가가 없으며 최신 다른 Main 금액을 보존한다.
- focus trap·Escape·닫은 뒤 각 진입점 복원·44px·offline 잠금을 390/768/1280에서 검증했다. 모션 감소 상태에서 하단 바의 inherited visibility가 focus 복원을 막던 문제는 숨김을 display로 전환해 해결했고 관련 7개 테스트가 통과했다.

## 최종 명령과 범위

- `npm run check`: source·unit TypeScript 통과.
- `NODE_OPTIONS=--no-experimental-webstorage npx vitest run`: 142개 파일, **1,330개 통과**. Node 26의 내장 Web Storage와 jsdom 충돌을 피하기 위해 해당 옵션을 사용했다.
- `npx playwright test --max-failures=5`: **169개 통과, 1개 skip, 실패 없음**. skip은 별도 PWA 프로젝트용 offline gate로 아래 production PWA 검증을 별도로 실행했다. 최종 실행 중 소스·문서 파일을 변경하지 않았다. 앞선 실행의 Simulation 스크롤·도넛 선택 간헐 실패는 각각 독립 3회 통과를 확인했으며, Simulation 측정은 폰트 준비 후 실행하도록 안정화했다.
- `node scripts/test-workspace-db.mjs`: disposable PostgreSQL에서 170개 기존 TS/SQL fixture와 12개 지출 fixture, v4→v5 before-image·rollback·RLS·CAS·receipt·원자적 서버 합산 통과.
- `node scripts/test-account-pwa.mjs`: production PWA shell 30개 cache 항목, Auth/Data/OAuth code cache 제외, 인증 후 offline 읽기 전용 재방문 통과.
- `npm run check:harness`, `git diff --check`, 변경 문서 8개의 상대 파일 링크 확인: 통과.
- public test Supabase 환경값을 사용한 `npx vite build`: 통과. 버전 증가 없는 직접 Vite 빌드다.

변경 범위: Main 요약·도우미·편집과 Main 소유 repository, workspace v5 parser/이전/백업/계정 캐시/RPC, 신규 SQL과 호환성 검증이다. PRD·DESIGN·README·AGENTS도 현재 경계와 일치시켰으며 앱 설치 설명의 지출 용어도 통일했다. 후속 진행 요청으로 운영 Supabase migration·Pages 배포·실제 계정 저장 검증까지 완료했다. [v5 운영 기록](docs/superpowers/evidence/2026-09-10-expense-assistant-production-rollout.md)에 배포 commit, 기존 데이터 보존, 두 브라우저 재개·합계 대체와 실제 390px·768px·1280px 화면을 기록했다. 아래 이전 단계의 로컬 검증 기록과 구분한다.

---

# 이전 기록: Main 지출 용어·단일 편집 진입점 — 후속 Design QA

검토일: 2026-09-10. 이 기록은 도우미 구현 이전 상태다. 당시 검증과 결정을 이력으로 보존한다.

사용자 피드백을 반영해 `소비`를 `지출`로 통일하고 네 행의 연필을 제거했다. 상단의 `월 금액 편집` 하나로 기존 다섯 값 편집기를 연다. 행은 도넛 탐색을 수행하며 지출의 주거·생활 상세도 접근성 설명으로 제공한다. 기존 저장값·계산 키·서버 schema는 변경하지 않았다.

## 최신 시각 증거

- [선택 시안과 현재 결과의 나란히 비교](docs/reviews/2026-09-10-main-refinement/expense-comparison-result.png): 왼쪽은 선택된 원본, 오른쪽은 사용자 피드백을 적용한 현재 390×844 화면이다. 원본은 높이 844로 비례 축소 후 결과 화면 영역을 분리했다. 편집 아이콘 제거·상단 진입점·지출 문구는 명시적으로 요청된 차이다.
- [390px 결과](docs/reviews/2026-09-10-main-refinement/expense-result-390.png), [390px 편집](docs/reviews/2026-09-10-main-refinement/expense-editor-390.png)
- [768px 결과](docs/reviews/2026-09-10-main-refinement/expense-result-768.png), [768px 편집](docs/reviews/2026-09-10-main-refinement/expense-editor-768.png). 결과는 투자 hover가 활성화된 상태다.
- [1280px 결과](docs/reviews/2026-09-10-main-refinement/expense-result-1280.png), [1280px 편집](docs/reviews/2026-09-10-main-refinement/expense-editor-1280.png)
- [viewport 측정](docs/reviews/2026-09-10-main-refinement/expense-viewport-check.json): 여섯 화면 모두 가로 overflow 없음, 폰트 loaded, 화면 안 control 높이 최소 44px. 새 편집 버튼은 약 88×44px이다.
- [Orca 상호작용 기록](docs/reviews/2026-09-10-main-refinement/expense-interactions.json): 세 폭 모두 편집 초기 focus는 닫기 버튼, 닫은 뒤 focus는 단일 월 금액 편집으로 복원. sheet/panel은 viewport 안에 포함된다.

나란히 비교와 여섯 렌더를 직접 열어 확인했다. 원본의 단일 요약 표면·금액 위계·밀도를 유지하면서 수정 의미를 명확히 했다. 중복 도넛 수치 생략, 기존 브랜드 서체와 실제 색상, 한 줄 편집 footer는 초기 QA에서 설명한 의도적 차이다. 이번 후속 수정에서 새로 남은 P0/P1/P2 시각 차이는 없다.

## 최신 검증

- `npm run check`: source·unit TypeScript 통과.
- `npx vitest run tests/unit/main tests/unit/journey/MainPlanEditOverlay.test.tsx`: 350 통과, 1 실패. 실패는 숨겨진 상세 영역과 요약에서 같은 `남는 돈`을 찾던 테스트 locator였다. 요약 영역으로 범위를 좁힌 뒤 `npx vitest run tests/unit/main/SummaryDashboard.test.tsx`: 21/21 통과. 다른 330개 통과와 합쳐 대상 351개를 확인했다.
- `npx playwright test --max-failures=5`: **163 통과, 1 skip**, 실패 없음. Main setup·도넛·편집·저장, cross-app 이동, mock Supabase 충돌·복구, Main overlay와 tooltip/모션 회귀를 포함한다. skip은 별도 PWA 프로젝트 전용 offline gate다.
- `git diff --check`, 수정 문서의 상대 링크와 현재/향후 상태 대조 통과.

실제 운영 Supabase 연결·DB migration은 이번 변경 표면이 아니며 실행하지 않았다. Orca는 기존 로컬 제품 컴포넌트 harness, cloud E2E는 mock Supabase를 사용했다.

## 변경과 다음 범위

Main 요약/도넛/설정의 표시 용어, 단일 편집 버튼과 관련 CSS, 해당 Main·journey·계정·tooltip·모션 테스트를 갱신했다. [DESIGN](DESIGN.md)과 [PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)도 현재 UI와 일치시켰다.

[지출 도우미 설계안](docs/superpowers/specs/2026-09-10-main-expense-assistant-design.md)은 사용자 결정인 “항목별 답변 기억, 완료 시 기존 추정치 대체”와 기존 workspace JSONB 확장·호환성 범위를 정리한다. 도우미 UI·항목별 저장·migration은 아직 구현되지 않았다. 다음 구현 담당자는 이 설계안과 연결된 v4 통합 설계에서 시작한다.

최신 UI 검증 결과: passed.

---

# 이전 기록: Main 목록형 컴포넌트 리뉴얼 — Design QA

- 검토일: 2026-09-10
- 범위: Main 결과, Main 소유 다섯 금액 편집기, 적용 footer, Simulation 진입 영역.
- 선택 근거: 사용자가 채팅에 표시된 두 번째 시안의 직관성을 선택했다. 기존 UX와 브랜드 위에서 위계·밀도를 정교화한다.
- source visual truth: [선택된 두 번째 시안](docs/reviews/2026-09-10-main-refinement/selected-direction.png)
- 구현 URL: `http://127.0.0.1:5410/IndividualSavingsFlowUI/apps/main/`
- 계약: [DESIGN](DESIGN.md), [Product PRD](docs/ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md).

## Findings

현재 비교에서 남은 actionable P0/P1/P2 차이는 없다. 시안의 단일 요약 표면, 정렬된 금액 행, 독립된 연필 편집, label–input 행과 한 줄 footer를 구현했다. 원호 선택·금액 계산·적용된 값과 draft의 경계는 유지했다.

의도적으로 조정한 부분:

- 시안의 중복된 `15.6%`를 도넛 옆에 한 번 표시한다. 선택된 항목의 명칭·금액·비율도 이 위치에 나타난다.
- 시안의 가짜 sheet 드래그 핸들은 넣지 않았다. 실제 닫기·취소·적용 동작을 제공한다.
- 기존 Gowun Batang/Gowun Dodum과 런처를 재사용한다. 생성 이미지의 합성 글자 모양·굵기를 별도 폰트나 이미지로 복제하지 않는다.
- 모바일 footer는 상태 문구와 44px 이상의 취소·적용 버튼을 포함한다. 편집 중인 필드의 기존 빠른 금액 조정은 해당 행 아래에서만 펼친다.
- 데스크톱은 기존 48rem 읽기 폭과 side panel 편집 방식을 유지한다. 모바일에서는 bottom sheet를 사용한다.

## 비교 증거

### 동일 상태의 전체 비교

- [결과 화면 비교](docs/reviews/2026-09-10-main-refinement/comparison-result.png)
- [편집창 비교](docs/reviews/2026-09-10-main-refinement/comparison-editor.png)

두 비교는 원본과 구현을 같은 입력 이미지 안에 나란히 배치해 확인했다. 기본 결과와 저장값이 변경되지 않은 편집 상태를 각각 비교했다.

원본은 두 모바일 화면을 포함하는 **1206×1304px** 생성 이미지다. 높이 844px에 비례 축소하고 좌·우 화면을 각각 분리해 390×844px 비교 영역에 배치했다. 원본 개별 화면은 축소 후 약 383px 폭이므로 나머지는 여백이며, 비율을 늘이거나 왜곡하지 않았다. 구현은 CSS viewport 390×844, deviceScaleFactor 1, 실제 PNG 390×844다. 비교 캔버스는 832×908이다. 원본의 약 7px 폭 차이를 결함으로 판정하지 않았다.

전체 비교가 1 CSS px 수준으로 표시되어 금액·라벨·입력·footer를 읽을 수 있다. 별도 확대 crop은 필요하지 않았다. 집중 확인 부위는 결과의 네 금액 행과 편집기의 다섯 label–input 행, 비활성 적용 버튼이다.

### 반응형과 추가 상태

| CSS viewport / PNG | 결과 | 편집 |
| --- | --- | --- |
| 390×844, DPR 1 | [결과](docs/reviews/2026-09-10-main-refinement/result-390.png) | [편집](docs/reviews/2026-09-10-main-refinement/editor-390.png) |
| 768×900, DPR 1 | [결과](docs/reviews/2026-09-10-main-refinement/result-768.png) | [편집](docs/reviews/2026-09-10-main-refinement/editor-768.png) |
| 1280×900, DPR 1 | [결과](docs/reviews/2026-09-10-main-refinement/result-1280.png) | [편집](docs/reviews/2026-09-10-main-refinement/editor-1280.png) |

- [모바일 focus·dirty·빠른 금액 조정 상태](docs/reviews/2026-09-10-main-refinement/editor-focused-390.png)
- [viewport 측정](docs/reviews/2026-09-10-main-refinement/viewport-check.json): 여섯 캡처 모두 문서 가로 overflow 없음. 화면 안에 보이는 일반 control의 최소 높이 44px. 폰트 로딩 완료.
- [실제 Orca 상호작용 기록](docs/reviews/2026-09-10-main-refinement/interaction-check.json): 저축 행 선택 → 9.4%·30만 원 상세, 편집 초기 focus, 35만 원 draft에서 적용 활성화, 취소 시 30만 원 복원·적용 비활성화, 닫은 뒤 `월 저축 편집` focus 복원. 새로 수집한 console error/warning 없음.

## 필수 fidelity 표면

| 표면 | 결과 |
| --- | --- |
| Fonts / typography | 기존 두 서체의 역할 유지. 모바일 제목 26px, 편집 제목 22px, 본문·라벨·비율 14–16px. 금액은 display 서체로 강조. 줄바꿈·단위·입력값 clipping 없음. |
| Spacing / layout | 개별 2×2 카드와 범례를 네 행으로 통합. 64px 이상 선택 행, 44px 연필 버튼, 68px 편집 행. 390px 기본 샘플에서 다음 단계 CTA까지 표시. 입력 focus 시 조정 버튼과 footer가 겹치지 않음. |
| Colors / tokens | Pearl canvas, white panel, ink/muted, orange 실행 CTA, teal 편집·선택 단서. 행 선택은 옅은 tint와 원호 강조로 표시. E2E의 행 텍스트 대비 4.5:1 이상 검사 통과. |
| Images / assets | 새 사진·삽화 자산 없음. 실제 앱의 런처 아이콘과 Lucide Pencil/X, 기존 데이터 기반 SVG 도넛·geometry·motion 재사용. UI를 래스터 이미지로 대체하지 않음. |
| Copy / content | 다섯 값과 네 결과·비율 유지. 주거·생활비 상세와 적자 문구 유지. 다음 단계 설명만 간결하게 조정. 저장·오류·재시도 상태 유지. |

## 검증

- `npm run check`: source와 unit TypeScript 검사 통과.
- `npx vitest run tests/unit/main tests/unit/journey/MainPlanEditOverlay.test.tsx`: **39 파일, 351 테스트 통과**. 선택과 편집의 분리, 음수 잔액의 텍스트 표시·도넛 제외 회귀 포함.
- `npx playwright test --max-failures=5`: **160 통과, 3 실패, 1 skip**. 실패 3개는 motion spec이 연필 버튼 내부에서 금액을 찾던 이전 DOM 기대값이었다.
- 해당 기대값을 금액 행으로 갱신한 뒤 `npx playwright test tests/motion-system.spec.ts`: **3 통과, 1 skip**. 전체 실행의 나머지 160개와 합쳐 **163개 통과 확인**. skip은 별도 PWA 프로젝트 전용 offline revisit gate이며 일반 Chromium 프로젝트에서 의도적으로 제외된다.
- E2E 범위에는 Main setup·적용·저장·복원·초과 지출·도넛 pointer/touch/keyboard·reduced motion, 네 앱 이동, Account Map의 Main overlay, mock Supabase의 저장·충돌·복구가 포함된다.
- 최초 E2E 시도는 설치된 Playwright 버전에 맞는 Chromium 실행 파일이 없어 시작하지 못했다. `npx playwright install chromium` 후 위 검증을 수행했다.
- 일반 `npx vite build`는 Supabase 연결 환경변수 부재로 실패했다. E2E와 같은 공개 테스트 설정으로 `VITE_SUPABASE_URL=https://isf-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test_fixture npx vite build`를 실행해 **번들 및 PWA 생성 통과**. 버전 변경을 만드는 `npm run build`는 사용하지 않았다.
- `git diff --check`와 변경 문서의 상대 링크 검사 통과.

## Comparison history

개발 중 첫 모바일 렌더에서는 다음 단계 버튼이 화면 아래로 밀려, 도넛·행·header 간격과 편집 제목 굵기를 조정했다. 조정 후 위의 원본/구현 결합 비교를 수행했다. 첫 결합 비교에서 추가로 수정해야 할 P0/P1/P2 차이는 발견하지 않았다. 이후 소스 수정은 들여쓰기 정리뿐이다.

## 변경 파일과 후속 범위

- `CashflowDonutSummary.tsx`, `CashflowSummary.tsx`, `SummaryDashboard.tsx`: 요약 표면과 금액 행·선택/편집 연결.
- `MainPlanEditor.tsx`, `ApplyBar.tsx`, `main.css`: 편집 위계, 입력 밀도, footer, responsive 표현.
- `JourneyEntryCard.tsx`: 다음 단계 표면과 문구.
- `DESIGN.md`, 관련 Main·journey·cloud·motion 테스트: 선택된 디자인 계약과 관찰 가능한 동작을 일치시킴.

실제 운영 인증·서버 연결은 이번 시각 검증에 포함하지 않았다. 로컬 호환성 harness는 현재 제품 컴포넌트와 샘플 데이터를 사용한다. 일반 E2E의 cloud 프로젝트도 실제 운영 계정이 아닌 mock endpoint를 사용한다. Account Map 자체의 지도 라벨 문제와 다른 앱의 컴포넌트 리뉴얼은 후속 범위다. 후속 작업은 디자인/프론트엔드 담당자가 DESIGN의 Main 규칙과 이 비교 증거에서 시작한다.

final result: passed
