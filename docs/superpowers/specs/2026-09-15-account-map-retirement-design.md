# Account Map 앱 제거

2026-09-15 사용자 요청에 따라 Account Map을 지원 제품에서 제거한다. 현재 지원 앱은 Main, Simulation, Portfolio 세 개다. 이 문서는 과거 Account Map 기능 spec의 지원 상태를 대체하며 저장 데이터의 의미는 유지한다.

## 제거와 보존

| 표면 | 처리 |
| --- | --- |
| 런처·앱 목록·인증 후 목적지 | Account Map 제거 |
| 기존 `apps/account-map/` 및 `index.html` | Main으로 이동하는 정적 호환 페이지만 유지 |
| 지도·계좌/목적/이체 편집·전용 Main overlay·준비 화면 | 진입점, UI, application, repository와 전용 동작 테스트 삭제 |
| 전용 계산·편집 command | 현 제품 소비자가 없으면 삭제 |
| `workspace.accountMap`, `workspace.locations` | 기존 schema v5와 서버 protocol 5 그대로 보존 |
| 구 schema, whole-workspace backup, 계정 cache·미전송 복구 | 검증·변환·원문 보존 계약 및 호환성 테스트 유지 |
| DB migration·RPC | 변경하거나 운영 데이터 삭제하지 않음; 구 클라이언트와 복구 호환 경계로 유지 |

Main·Simulation·Portfolio 저장은 기존 계좌지도와 위치 데이터를 보존한다. 새로운 계좌지도 UI나 독립 저장은 제공하지 않는다. 데이터 형식/파서가 `src/account-map/domain`에 남더라도 제품 runtime이 아니라 workspace 호환성 코드다. 과거 문서와 migration 기록은 삭제하지 않는다.

## 검증과 위험

런처에 세 앱만 노출되고 구 URL이 Main으로 연결되는 브라우저 회귀를 추가한다. 기존 계좌지도 데이터가 있는 workspace의 Main 편집·재조회 및 backup 왕복을 검증한다. 타입·단위·전체 E2E와 390px·768px·desktop UI를 확인하고 production build에 지도 UI chunk가 없는지 검사한다.

이미 열려 있거나 오프라인으로 캐시된 구 버전 클라이언트까지 강제 종료하지 않는다. 서버 schema와 저장값을 유지하므로 필요 시 이전 배포로 rollback할 수 있다. 계좌지도 데이터 자체의 영구 삭제는 이번 요청 범위에 포함하지 않는다.
