# Journey Snapshot 폐기 설계

## 목적

Main, Simulation과 Portfolio가 모두 현재 Main 데이터 또는 자체 저장소를 직접 읽으므로 중간 `JourneySnapshot` 저장 계약을 폐기한다. 앱 연결은 URL 탐색만 담당하고 데이터 연결은 각 상세 앱의 명시적인 read adapter가 담당한다.

이 결정은 `2026-07-29-app-journey-entry-design.md`의 snapshot 전달 설계와 이후 역사 문서의 관련 부분을 현재 제품 기준에서 대체한다. 역사 문서는 결정 경위로 보존하며 신규 구현 근거로 사용하지 않는다.

## 현재 문제

- Main은 Simulation CTA에서 `isf-journey-snapshot-v1`을 쓰지만 현재 Simulation은 그 값을 소비하지 않는다.
- Portfolio는 최신 `isf-main-v2`의 `monthlyInvestmentWon`을 직접 읽으므로 Simulation→Portfolio snapshot이 필요 없다.
- Account Map 준비 화면도 snapshot을 소비하지 않는다.
- 공용 `ReadinessApp`에는 접근할 수 없는 Simulation·Portfolio 준비 분기와 관련 테스트가 남아 Account Map 번들에 포함된다.
- Portfolio의 Main source adapter는 격리를 위해 현재 Main validator를 복제해 스키마 확장 시 불일치 위험이 있다.
- 기존 격리 테스트는 `src/portfolio/**` 문자열만 검사하여 외부 모듈을 통한 간접 legacy import를 증명하지 못한다.

## 승인된 경계

### 탐색과 데이터 소유권

- Main→Simulation, 런처의 앱 이동과 Main 편집 deep link는 URL 탐색만 수행한다.
- Simulation은 최신 Main 저축·투자를 읽기 전용 adapter로 직접 읽는다.
- Portfolio는 최신 Main 투자금을 읽기 전용 adapter로 직접 읽는다.
- Portfolio와 Simulation은 Main에 write-back하지 않는다.
- Account Map은 독립 데이터 계약이 승인될 때까지 정적 준비 화면만 제공한다.

### JourneySnapshot 코드 폐기

다음을 현재 source와 활성 테스트에서 제거한다.

- `src/journey/domain/journeySnapshot.ts`
- `src/journey/infrastructure/journeyRepository.ts`
- `JourneySnapshot`, `JourneyRepository`와 생성·parse 함수
- Main의 snapshot repository 주입, 저장, 저장 실패 상태와 문구
- Simulation·Portfolio readiness 분기와 snapshot handoff
- snapshot 전용 unit fixture와 browser 계약

`src/journey/routes.ts`, `AppLauncher`, Main의 journey CTA와 앱 route 자체는 현재 탐색 계약이므로 유지한다.

### 저장 데이터 폐기

구데이터 호환성은 제공하지 않는다. Main bootstrap에서 전용 폐기 청소 함수가 `localStorage.removeItem('isf-journey-snapshot-v1')`을 호출한다.

- 값을 읽거나 JSON parse하지 않는다.
- 신규 저장 형식으로 변환하지 않는다.
- 삭제 실패는 Main 시작을 막지 않는다.
- 폐기 키 참조는 청소 모듈과 그 테스트 한 곳에만 허용한다.
- Simulation과 Portfolio runtime 및 repository에는 해당 키가 없어야 한다.

청소 함수는 legacy 호환 adapter가 아니라 폐기된 전용 키의 best-effort 정리 경계다. 후속 저장소 정리에서 지원 대상 브라우저의 배포 전환이 끝났다고 판단되면 함수와 키 문자열도 함께 제거할 수 있다.

### Main 계약 공유

Portfolio는 Main 전체 저장 schema를 복제하지 않는다. Main이 공개하는 현재 데이터 parser를 공유한 뒤 `updatedAt`과 `monthlyInvestmentWon`만 projection한다. Main schema가 바뀌면 parser 한 곳에서 계약을 갱신하고 모든 소비자가 같은 판정을 사용해야 한다.

### Account Map 준비 화면

`ReadinessApp`은 Account Map 전용 컴포넌트로 축소한다. repository, 시간, 탐색 callback과 연결 상태를 받지 않고 다음만 표시한다.

- 공용 AppLauncher
- `Account Map 준비 중` 제목
- Main과 분리해 신규 설계될 예정이라는 안내
- Main 이동 링크

## 검증 설계

### TDD 회귀

- Main의 Simulation CTA가 storage write 없이 해당 route로 이동한다.
- Main 시작 시 폐기 키가 삭제되고 삭제 실패에도 Main이 열린다.
- Account Map 준비 화면이 snapshot repository 없이 렌더링된다.
- Portfolio Main adapter가 Main의 공용 현재 데이터 parser와 같은 유효성 판정을 사용한다.

### 정적·번들 격리

현재 entry에서 시작해 실제 TypeScript import graph를 순회하거나 production build manifest/chunk를 검사한다. 다음은 폐기 청소 모듈을 제외한 활성 runtime에 없어야 한다.

- `JourneySnapshot`, `JourneyRepository`
- `isf-journey-snapshot-v1`
- 삭제된 Portfolio script, module, stylesheet와 `src/entries/step3.ts`
- `isf-step3-portfolios-v2`, `isf-step3-snapshots-v1`, `IsfStorageHub`
- 과거 Portfolio readiness selector와 entry

### 필수 검증

- `npm run check`
- `npm run test:unit`
- `npm run test:e2e -- --reporter=list`
- production build와 Portfolio·Account Map chunk 문자열 검사
- `git diff --check`

## 문서 변경

현재 상태를 설명하는 README, Product PRD, DESIGN, Requirements, Roadmap, State와 codebase maps에서 snapshot 데이터 전달 주장을 제거한다. 과거 Superpowers spec·plan은 역사 자료로 유지하고 이 명세의 대체 관계를 명시한다.

## 인수 조건

- 상세 앱 이동은 snapshot 저장 성공 여부와 무관하다.
- `JourneySnapshot` source, repository와 활성 테스트가 제거된다.
- 기존 `isf-journey-snapshot-v1`은 읽기·변환 없이 best-effort 삭제된다.
- Portfolio와 Simulation은 최신 Main을 직접 읽는 현재 계약을 유지한다.
- Account Map 번들에 Simulation·Portfolio readiness 구현이 포함되지 않는다.
- Portfolio가 Main schema를 복제하지 않는다.
- 실제 import graph 또는 production bundle 검사가 간접 legacy 유입을 실패시킨다.
- canonical 문서가 URL 탐색과 직접 Main read 경계를 동일하게 설명한다.
