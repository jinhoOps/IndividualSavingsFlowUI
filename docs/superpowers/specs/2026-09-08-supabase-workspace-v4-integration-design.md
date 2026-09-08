# Supabase Workspace v4 통합 설계

상태: 2026-09-08 사용자 승인 — 최신 main의 v4 기능을 보존하는 Supabase 호환성 개발, 운영 DB 업그레이드와 로컬 main 병합을 승인했다. 원격 Git push·Pages 배포·Google provider 설정은 포함하지 않는다.

## 기준과 범위

기존 [계정 저장 설계](2026-09-07-supabase-account-workspace-design.md)의 정적 웹·실제 Auth·계정당 workspace·RLS·CAS·복구 계약을 최신 main의 workspace v4 및 Account Map 계획 흐름 계약에 통합한다. v4는 Account Map applied v2/v3, draft v1/v2를 수용하며 envelope 변환만으로 하위 slice나 transfer를 생성하지 않는다. Main의 다섯 월 금액은 Main repository만 쓴다. Account Map의 Main 편집 overlay도 이 경계를 유지한다.

## 서버 전환

- 이미 적용된 migration 세 개는 수정하지 않는다. 추가 migration `202609080002_workspace_v4.sql`에서 v4 validator와 RPC 계약을 배포한다.
- 전환은 한 transaction이다. 기존 모든 v3 payload를 검증하고 before-image를 `private.workspace_schema_backups`에 보관한 뒤 `schema_version`만 4로 전환한다. payload, revision, created_at, updated_at과 성공 receipt는 그대로 유지한다. 손상된 행이 있으면 전부 rollback하고 원인을 보고한다.
- before-image는 사용자 FK와 함께 삭제되며 강제 RLS를 사용한다. anon·authenticated·service_role·RPC 역할에 접근 권한을 주지 않는다. 자동 삭제나 과거 데이터로의 자동 복원은 없다. 운영자가 전환 안정성을 확인한 뒤 보관·폐기 또는 명시적 복원을 결정한다.
- 초기 행과 일반 쓰기는 v4만 허용한다. 여섯 RPC는 기존 인자에 필수 `p_schema_version integer`를 추가하며 값은 4만 허용한다. 구 signature는 같은 transaction에서 제거하고 default/overload를 남기지 않는다. 이미 열린 v3 앱은 새 저장을 수행할 수 없다.
- mutation request hash에 schema version을 포함한다. 기존 receipt를 삭제하거나 다른 protocol의 요청에 재사용하지 않는다. v4의 동일 ID·동일 요청 재시도는 기존대로 한 번만 저장된다.
- 전용 NOLOGIN/NOBYPASSRLS 역할과 검증된 request UID, 빈 search_path, authenticated SELECT-only, 좁은 slice RPC, revision 비교와 원자적 전체 검증은 유지한다.
- SQL은 최신 TS v4 parser의 정규화와 참조 검증을 따른다. transfer ID 유일성, 모든 endpoint 존재·자기 이체 금지, active pair 중복·보관 endpoint·한 출발지 복수 sweep·cycle 금지를 검사한다. 금융 부족이나 zero fixed 금액은 구조 오류로 취급하지 않는다.

## 클라이언트와 기존 데이터

- 원격 row decoder는 v4만 writable snapshot으로 채택한다. v3 또는 미지원 미래 row는 자동 초기화·덮어쓰기 없이 update/recovery 안내와 raw export를 제공한다.
- RPC 호출에는 항상 `p_schema_version: 4`를 보낸다. 계정 토큰 고정·generation fencing·CAS·소유 slice 경계는 바꾸지 않는다.
- 기존 브라우저 원본은 최신 main repository의 v4 우선, 없을 때만 v3→retired 후보 규칙을 사용한다. 이전은 사용자 확인 후 수행하고 v3/v1 원본을 쓰거나 삭제하지 않는다. 백업은 최신 format v3를 내보내며 기존 format v2/v1은 검증·변환 후 원자적으로 가져온다.
- 계정 캐시는 v4 앱용 별도 namespace를 사용한다. 구 v3 캐시·미전송 요청은 새 protocol로 자동 재전송하지 않고 원본을 보존해 복구 다운로드로 제공한다. 유효한 구 snapshot은 필요 시 v4 envelope로 읽기 전용 변환할 수 있지만 서버 확정 저장으로 표시하지 않는다. 같은 계정의 명시적 logout은 양쪽 세대 캐시·복구 기록을 지운다.
- 새로운 Account Map Journey에 계정의 Account Map repository와 Main repository를 각각 주입한다. Main overlay는 `session.scope('main')`만 사용한다. Account Map의 locations/accountMap 쓰기와 분리하고 로컬 fallback을 금지한다.
- 최신 main의 setup·flow editor·location editor·overlay 행동을 유지하면서 계정별 미전송 입력 복구, 만료·오프라인 차단, 충돌 후 명시적 재적용과 Main-null 시 replay 폐기를 연결한다.

## 검증과 적용 순서

1. 격리된 현 브랜치에 최신 main을 통합한다. 사용자 package-lock 변경과 다른 worktree는 보존한다.
2. v4 SQL/TS shared fixture, v3 before-image·원자적 업그레이드·구 RPC 거절·v4 CAS/receipt/동시성/RLS 테스트를 실행한다.
3. 단위·타입·전체 E2E·production build·PWA를 검증한다. cloud E2E는 transfer 저장/reload, Journey Main overlay 저장과 미전송 복구, v3 원본 보존을 포함한다. 390px·768px·desktop UI 계약을 확인한다.
4. 독립 코드 리뷰와 커밋 후 운영 DB를 다시 읽기 전용 점검한다. 기존 사용자 데이터 수나 상태가 예상과 달라도 삭제·초기화하지 않는다. 검증된 추가 migration만 transaction으로 적용한다.
5. 새 일회성 테스트 계정의 실제 Auth/REST/RPC 및 두 브라우저로 v4 transfer·Main overlay·계정 격리를 확인한다. 사용자 대신 계획을 만들지 않는다. 테스트 계정과 그 행·receipt·backup만 정확한 ID로 정리한다.
6. main의 새 변경 여부를 다시 확인하고 검증된 브랜치를 로컬 main에 병합한다. 원격 push나 웹 배포 성공을 주장하지 않는다.

운영 rollback은 구 writable 앱으로 되돌리는 방식이 아니다. 문제가 있으면 쓰기를 중지하고 확정 데이터·복구 원본을 보존하며, before-image와 최신 데이터를 비교한 별도 복원 작업으로 처리한다.
