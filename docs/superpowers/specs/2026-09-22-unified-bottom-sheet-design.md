# 세 앱 공통 바텀시트·모달 표면 설계

## 목적

Main, Simulation, Portfolio가 서로 다른 바텀시트와 모달 구현을 사용하면서 생긴 높이, 여백, 모션, footer, focus 차이를 하나의 표면 계약으로 통일한다. 화면별 금융 상태와 저장 책임은 각 앱에 남기고, 표면의 외형·반응형 전환·종료·접근성·내부 큰 배치만 공통화한다.

이관 전에는 `ResponsiveDialog`, Portfolio 전용 `PortfolioDialog`, Main 전용 `main-editor-sheet`와 각 앱의 `useSheetDismiss` 연결이 같은 역할을 나눠 갖고 있었다. 현재는 확장된 `ResponsiveDialog`를 세 앱의 기준 표면으로 사용한다.

## 범위와 제외

포함:

- 767px 이하 하단 부착 Bottom Sheet와 768px 이상 중앙 Modal의 공통 표면
- header, context/summary, scrollable body, 상태 영역, footer의 내부 배치
- backdrop, scroll lock, focus trap/복원, Escape·backdrop click·drag 종료와 reduced-motion 처리
- Main 월 금액·지출 도우미·남는 돈, Simulation 조건, Portfolio 배분·항목 편집·설정·결과 미리보기의 이관
- 각 앱에서 같은 표면 안에 표시할 정보 순서와 단계 전환 계약

제외:

- Main이 소유한 다섯 월간 값과 지출 답변의 저장 모델 변경
- Simulation과 Portfolio의 draft·적용·복구 데이터 계약 변경
- workspace schema v5, protocol 5, accountMap/locations 보존 계약 변경
- 백테스트, 시세 수집, 수익률 보장, 새로운 계정 화면
- 별도 modal 라이브러리 도입

## 공통 표면 계약

### 반응형 기준

CSS viewport 폭만 기준으로 presentation을 선택한다.

| viewport | 표면 | 기준 |
| --- | --- | --- |
| `<= 767px` | Bottom Sheet | 하단 부착, 수평 중앙, 최대 `92dvh`, safe-area 반영 |
| `>= 768px` | Modal | 중앙 정렬, 기본 폭 `640px`, 확장 폭 `720px` 또는 preview `960px`, 최대 `calc(100dvh - 48px)` |

같은 열린 편집 상태에서 viewport가 767px과 768px 사이를 넘으면 draft, 입력값, 오류, 스크롤 의미를 버리지 않고 presentation만 전환한다.

### 표면 구조

모든 표면은 다음 DOM 역할을 갖는다.

```text
dialog/backdrop
└─ surface frame
   ├─ header: handle, eyebrow, title, optional back/close
   ├─ context: 기준 금액·상태·단계·요약(선택)
   ├─ body: 유일한 scroll container
   ├─ status: 오류·저장 중·충돌·안내(선택)
   └─ footer: 취소·적용 또는 단계 action
```

- 모바일 handle은 header의 장식과 drag 시작 지점으로만 사용한다.
- header와 footer는 flex-shrink를 막아 항상 보인다.
- body만 `min-height: 0; overflow-y: auto; overscroll-behavior: contain`을 갖는다.
- footer는 safe-area bottom padding을 포함하고 body의 마지막 행을 가리지 않는다.
- 일반 조작 영역은 최소 44×44px, keyboard focus ring과 accessible name을 갖는다.
- title은 dialog accessible name의 기준이며, back은 왼쪽, close는 오른쪽에 둔다.

### 표면 유형

내부 배치는 네 가지 유형으로 제한한다.

#### 편집형

```text
header → 현재 기준 요약 → 입력 그룹 → 계산/검증 안내 → status → 취소/적용
```

Main 월 금액, Main 남는 돈, Simulation 조건, Portfolio 배분이 사용한다.

#### 단계형

```text
header(back/title/close) → 현재 단계 설명 → 목록 또는 상세 → 이전/다음/완료
```

Portfolio 투자 대상 선택·샘플 선택에 사용한다. 부모 표면 위에 자식 bottom sheet를 중첩하지 않고 같은 표면의 단계 전환으로 처리한다.

#### 설정형

```text
header → fieldset 그룹 → 계정/복구 그룹 → 위험 작업 영역
```

톱니 메뉴와 보기 설정에 사용한다. `role="menu"` 안에 토글·폼을 섞지 않고 일반 dialog의 fieldset과 button으로 제공한다.

#### 미리보기형

```text
header → 3:4 결과 이미지 → 옵션/개인정보 안내 → status → 닫기/저장/공유
```

Portfolio 결과 이미지 저장·공유에 사용한다. 이미지 생성 전에는 업로드하지 않는다.

## 앱별 내부 배치

### Main

#### 월 금액 편집

```text
월 금액 편집 / 닫기
Main 기준과 현재 저장 상태
수입·고정지출·생활비·저축·투자 다섯 행
합계/남는 돈 계산 안내
저장 오류 또는 충돌 안내
취소 / 적용
```

다섯 값의 소유권, 적용 확인, 저장 실패·충돌·복구 동작은 기존 Main controller가 유지한다.

#### 지출 도우미

```text
지출 계산 / 닫기
현재 질문과 진행 단계
질문 입력 또는 답변 확인
답변이 반영할 금액 요약
필드 오류/저장 상태
이전 / 다음 또는 완료
```

중간 답변 저장과 재접속 복구는 기존 도우미 state가 소유한다.

#### 남는 돈 분배

```text
남는 돈 분배 / 닫기
이번 달 남는 금액
저축·투자·현금 배분 행
미배분 또는 초과 안내
취소 / 적용
```

### Simulation

```text
조건 편집 / 닫기
명목 · 실질 토글
기간 · 기대수익률 · 시작 자산 · 목표
기준금리 · 물가
기존 입력 검증과 자동 저장
```

명목·실질 토글은 첫 viewport 안에 보인다. 기존 Simulation 자동 저장과 그래프 즉시 반영을 유지하며, 별도의 취소/적용 단계나 local draft를 추가하지 않는다. 이 자동 저장 표면은 footer action을 생략한다. 닫기는 편집 표면만 닫으며 저장 실패·충돌은 기존 복구 계약을 따른다.

### Portfolio

#### 배분 편집

```text
투자 배분 수정 / 닫기
월 투자금 + 성장/안정 + 현금 요약
투자 대상 요약 행 목록
현금 행
투자 대상 추가
미배분/합계 검증
취소 / 적용
```

#### 대상 편집 단계

부모 배분 표면 내부에서 다음 단계로 전환한다.

```text
뒤로 / 투자 대상 수정 / 닫기
이름
성장 · 안정 선택
금액과 계산 비율
빠른 조정
삭제(수정 모드만)
취소 / 완료
```

항목 편집과 폐기 확인은 별도 nested sheet를 만들지 않는다. 확인이 필요한 경우 같은 표면의 최상위 확인 modal 하나만 사용하고, 취소하면 부모 단계·스크롤·focus를 복원한다.

#### 결과 이미지 미리보기

```text
계획 이미지 저장/공유 / 닫기
실제 생성 PNG 미리보기
금액 포함 스위치
개인정보·48시간 링크 안내
생성/실패/만료 상태
닫기 / 이미지 저장 또는 공유 링크 만들기
```

## 공통 동작과 상태

앱은 하나의 `requestClose(reason)`으로 다음 종료 원인을 처리한다.

| 상태 | X/Escape/backdrop/drag | 적용/완료 |
| --- | --- | --- |
| clean | 즉시 종료, 진입점 focus 복원 | 실행 가능 |
| dirty | 폐기 확인 | 검증 후 실행 |
| saving/pending | 종료와 중복 조작 차단 | 진행 상태 유지 |
| error/conflict/uncertain | 표면 유지, 입력·재시도 유지 | 실패를 성공으로 닫지 않음 |

- Background는 inert 처리하고 document scroll을 잠근다.
- 모바일 drag는 handle/header에서만 시작한다. 입력, 버튼, slider, body scroll에서는 시작하지 않는다.
- 열기 모션은 Anime.js surface spring의 `opacity + translateY`를 사용한다.
- 닫기 모션은 같은 표면의 reverse motion을 사용한다.
- reduced-motion, layout 측정 실패, animation 초기화 실패, unmount에서는 최종 상태를 즉시 반영한다.
- 모바일 browser Back은 sheet 종료와 내부 단계 뒤로가기를 구분한다. history state를 추가할 경우 overlay당 한 단계만 사용한다.

## 구현 경계

### 기준 컴포넌트

- `src/components/common/ResponsiveDialog.tsx`: native dialog, presentation, slots, backdrop, focus, scroll lock, busy/close contract를 소유한다.
- `src/components/common/responsive-dialog.css`: 공통 surface geometry와 breakpoint를 소유한다.
- `src/components/motion/useSheetDismiss.ts`: handle drag와 dismiss guard를 공통 shell에서 재사용한다.
- `src/components/motion/tokens.ts`: duration, distance, spring token을 계속 사용한다.

Portfolio 전용 `PortfolioDialog`와 Main 전용 sheet geometry는 제거했다. 앱별 controller는 draft, validation, persistence, recovery, domain action만 소유한다.

### 완료한 이관

1. 공통 shell과 visual tokens
2. Main 월 금액·지출·남는 돈
3. Simulation 조건 편집
4. Portfolio 배분·대상 편집·적용 확인
5. 설정 표면과 결과 이미지 미리보기
6. 중복 `PortfolioDialog`·Main 전용 sheet CSS 제거

각 단계는 이전 단계의 focus·close·body scroll contract를 사용하며, 두 종류의 공통 dialog를 병행하지 않는다.

## 검증 계약

### 단위/통합

- 공통 surface: presentation 전환, body만 scroll, footer 고정, focus trap/복원, Escape/backdrop/drag, dirty/saving/error, reduced-motion
- Main: 다섯 값 소유권, 지출 중간 저장, 남는 돈 검증, 적용 실패·충돌 복구
- Simulation: 명목/실질 첫 노출, 조건 변경 자동 저장, 외부 Main 변경, 저장 실패
- Portfolio: 부모→대상 단계 전환, 합계 검증, 삭제/취소 focus 복원, nested trap 부재

### 브라우저

최소 다음 viewport에서 Main·Simulation·Portfolio 편집 표면을 확인한다.

- 390×844: Bottom Sheet, footer 가림, drag, keyboard focus
- 768×1024: 중앙 Modal 전환 경계
- 1280×900: 중앙 정렬, backdrop containment, 넓은 body
- 320×568 및 390×600: 짧은 화면, 내부 body scroll, safe area
- 200% 확대: 가로 overflow와 focus ring

검증은 `npm run check`, 관련 unit test, 관련 Playwright flow로 수행하고, 기존 전체 E2E 실패는 변경 원인과 분리해 기록한다. 실제 iOS Safari·Android Chrome·VoiceOver/TalkBack은 자동 브라우저 검증과 별도의 증거로 기록한다.

## 완료 기준

- 세 앱이 같은 breakpoint, radius, backdrop, handle, motion, footer 규칙을 사용한다.
- 모바일 편집 표면은 모두 아래에서 올라오고, desktop 편집 표면은 모두 중앙에 열린다.
- 내부는 header/context/body/status/footer 구조를 따르고 body만 스크롤된다.
- Portfolio와 Main의 중복 dialog shell이 제거된다.
- dirty/saving/error/conflict 상태에서 입력과 복구 흐름이 보존된다.
- 390·768·1280px에서 footer 가림, 가로 overflow, 이중 focus trap이 없다.
- 데이터 소유권·저장 schema·protocol은 변경되지 않는다.
