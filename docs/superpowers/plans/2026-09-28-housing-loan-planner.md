# 주거 대출 설정 구현 계획

2026-09-28 사용자 구현 요청. 기준은 [대출 설계](../specs/2026-09-28-housing-loan-cashflow-proposal.md)이며 그래프는 사용자 첨부 이미지의 원금/이자 비교와 [Anime.js React](https://animejs.com/documentation/getting-started/using-with-react), [SVG](https://animejs.com/documentation/svg) 문서를 참고한다.

## 저장 결정

workspace v5·protocol 5와 다섯 Main 금액을 유지한다. 지출 도우미 내부 schema 2에만 `draft.housingLoans`와 반영 시점의 `lastApplied.housingLoans`를 추가한다. schema 1의 13개 답변과 이자 원본은 그대로 읽고 보존한다. 새 형식 사용은 명시적인 대출 설정 저장에서 시작한다.

대출 계획이 존재하면 `housingInterest` 원본은 합산에서 제외하고 선택 월의 정기 납입액을 대신 합산한다. null은 기존 이자 수동 입력, 빈 대출 목록은 대출 없음이다. 만기 원금은 반복 주거비에 넣지 않고 별도 의무로 표시한다. 완료 전에는 Main 적용 금액을 바꾸지 않는다. 서버도 같은 정수 원 단위 계산을 사용한다.

새 형식이 없는 기존 계정은 변화가 없다. schema 2 이후 구 클라이언트의 지출 schema 1 덮어쓰기는 거부하며, 일반 Main/다른 앱 저장은 도우미를 보존한다. 구 앱은 새 형식 계정에서 새로고침이 필요하다. 전체 복원은 명시적인 원자적 replacement 계약을 유지한다. 새 백업은 기존 envelope 안에 내부 버전을 포함하며 구 앱에서 새 내부 버전의 복원은 지원하지 않는다.

## 구현 범위

- [x] 세 상환방식·거치·0%·남은 원금 기준의 월별 계산과 strict parser.
- [x] 내부 schema 1/2 parser, 복구·백업·SQL 합계 및 다운그레이드 방지.
- [x] 지출 도우미에서 전용 공통 표면 전환, 복수 대출·조건·KPI·상환표.
- [x] 상환방식 개념 그래프 및 실제 상환값 SVG, Anime.js와 reduced-motion.
- [x] 월세/기타 주거비 중복 확인, 선택 월 정기 납입과 만기 의무 구분.
- [x] 단위·타입·DB·전체 E2E 및 390/768/desktop 시각 검증.
- [x] 검증 증거와 서버 migration 배포 순서 기록. PR·Pages 상태는 아래 기록에서 추적.

첫 제공 경로는 Main의 지출 도우미다. 월별 모델이므로 첫 납입 **월**과 남은 회차를 입력하며 일할·휴일 계산은 제공하지 않는다. 금리 변경은 새 기준 잔액·금리로 명시 재설정한다. 미래 금리 이벤트, 최초 Main 설정 중 대출 하위 흐름, 만기 재원/완납 후 투자액을 Simulation에 연결하는 단계는 후속이다. 현재 세 상환방식과 실제 계산 결과 저장을 대체하지 않는다.

## 검증

`npm run check`, 대출/지출/워크스페이스 focused unit tests, `npm run test:unit`, `node scripts/test-workspace-db.mjs`, Main/계정 브라우저 검사 및 전체 Playwright. 만기 원금을 정기 지출에 섞거나 구 이자와 새 납입액을 이중 합산하지 않는지 확인한다. 숫자 단독 입력으로 기능을 축소하지 않는다.

## 실행 결과

구현·검증과 운영 DB migration을 완료했다. PR·Pages 배포 및 남은 범위는 [검증·운영 기록](../evidence/2026-09-28-housing-loan-planner.md)을 따른다.
