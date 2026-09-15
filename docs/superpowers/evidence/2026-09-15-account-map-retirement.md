# Account Map 제거 검증

## 범위

[제거 설계](../specs/2026-09-15-account-map-retirement-design.md)에 따라 지원 제품을 Main·Simulation·Portfolio로 축소했다. 계좌지도 진입 모듈, UI·application·repository, 전용 Main overlay·준비 화면, 현 소비자가 없는 계산·편집 command를 삭제했다. 기존 directory·index URL은 정적 Main redirect만 제공한다.

삭제된 테스트는 제거된 지도·계좌·목적·이체 편집과 전용 overlay 동작을 검증하던 테스트다. `tests/unit/account-map`의 버전 변환·이체 검증·기관 이름·목적 기준 테스트 및 workspace 검증·migration·backup·계정 cache/복구 테스트는 보존했다. 새 cloud 테스트는 두 구 URL에서 write 없는 Main 이동과 세 앱 런처, Main 저장·새로고침 뒤 기존 accountMap·locations 보존을 390px·768px·1280px에서 검증한다. Simulation 저장 보존 테스트는 유지하고 Portfolio 저장·재조회 보존 테스트는 비어 있지 않은 계좌지도 fixture로 강화했다.

DB, schema v5, 서버 protocol 5, 원격 RPC, localStorage key 및 원본 저장 데이터는 변경하지 않았다. 기존 `package-lock.json` 작업자 변경은 커밋에 포함하지 않는다.

## 실행 결과

| 검증 | 결과 |
| --- | --- |
| 새 런처 단위 테스트 / 구 URL cloud 테스트, 구현 전 | 의도한 실패: 4개 목적지 / 구 지도 URL 유지 |
| `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci` | PASS: harness·소스/단위 타입, 114개 파일의 단위 테스트 1,009개 |
| `npx playwright test --output=/tmp/isf-retirement-final-e2e` | 177 PASS, 1 SKIP, 1 FAIL: 기존 브랜드 완성 프레임을 느린 assertion polling이 놓침 |
| `npx playwright test tests/account-workspace.spec.ts -g 'app launch landing and internal navigation use distinct screens' --repeat-each=3 --output=/tmp/isf-retirement-brand-recheck` | 테스트 polling 수정 후 9/9 PASS (390·768·1280 각각 3회) |
| 테스트용 공개 Supabase 설정으로 `npx vite build --manifest` | PASS: 계좌지도 JS entry/chunk 없음, 구 URL HTML은 script 없는 redirect |
| `node scripts/test-account-pwa.mjs` | PASS: production SW 26개 cache entry, Auth/Data/code URL 미캐시, 인증된 Main 오프라인 재방문 읽기 전용 |
| `git diff --check`와 변경 문서 상대 링크 검사 | PASS |
| 독립 코드 리뷰 | 중요 지적 없음 |

브랜드 테스트는 기존의 정확한 `opacity === '1'` 조건을 브라우저 프레임마다 확인하도록 변경했다. 제품 모션과 2.2초 장면 종료는 바꾸지 않았다. 전체 E2E를 수정 후 다시 실행한 결과는 아니며, 최초 전체 실행의 실패 1건과 같은 세 화면 검사를 수정 후 반복 검증한 결과다.

정상 E2E의 PWA 전용 1개 테스트는 service worker 차단 설정 때문에 기존대로 skip한다. 실제 production 서비스워커 동작은 별도 PWA 스크립트로 확인했다. 운영 DB 검증은 이번 변경에서 실행하지 않았다(서버·schema·DB 변경 없음).

## UI와 잔여 참조

390px·768px·1280px의 Main 캡처에서 세 앱 런처, 44px 조작 영역, 금액·그래프 표시와 overflow를 확인했다. 앱간 focus·관리 메뉴·저장 오버레이 회귀를 유지했다. 세 앱을 강제로 overflow시키는 synthetic dock 테스트는 768px에서 170px 컨테이너를 사용한다. 실제 390px 화면에서는 세 앱이 모두 직접 표시되며 별도 정상 모바일 검사로 검증한다.

지원 entry의 import closure에서 Account Map UI/application/infrastructure 참조가 없음을 확인했다. 남은 `accountMap`/`account-map` 참조는 정적 redirect, 제거 방지 테스트, workspace 데이터·백업·구버전/미전송 복구 계약과 과거 기록이다. 도메인 보존 이유는 [보존 데이터 계약](../../../src/account-map/domain/README.md)에 명시했다.

이미 열린 구 클라이언트나 오프라인 구 배포는 강제 종료하지 않는다. 데이터·서버 계약을 보존하므로 이전 배포로 rollback할 수 있다.
