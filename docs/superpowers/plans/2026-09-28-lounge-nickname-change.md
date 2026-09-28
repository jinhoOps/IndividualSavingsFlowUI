# 라운지 닉네임 변경 · 48시간 제한

사용자 요청: 변경 기능을 추가하고 한 번 변경하면 48시간 내 재변경을 금지한다. SQL injection 등 대표 공격 패턴도 방어한다. 기존 변경 불가 정책을 이 요청으로 대체한다.

## 동작

- 라운지 내 닉네임 오른쪽 `닉네임 변경`에서 공통 sheet/compact modal을 연다. 현재 이름·새 이름·48시간 제한·기존 공유 반영을 보여주고 명시적으로 변경한다.
- 최초 등록은 변경 횟수에 포함하지 않는다. 첫 변경은 즉시 가능하며 성공한 실제 변경 시각부터 정확히 48시간을 서버 시계로 검사한다. 실패·동일 이름 재시도는 시간을 연장하지 않는다. 대소문자만 바꾸는 경우에도 실제 변경으로 처리한다.
- 이미 쓰는 2~20자/NFC/허용 문자/대소문자 무시 UNIQUE를 유지한다. 변경 후 이전 이름은 다시 사용할 수 있다. 별도의 이름 이력·이미지·금액을 저장하지 않는다.
- 프로필의 nullable `nickname_changed_at`과 `nickname_version`을 추가한다. 기존 닉네임/게시물/workspace는 migration에서 바꾸지 않는다. 사용자 등록 v1 DTO와 기존 게시 RPC를 유지하고, 새 profile v2 조회/변경 RPC를 추가한다.
- UI는 서버가 내려준 현재 시각과 다음 가능 시각으로 대기 시간을 표시하고, 탭 복귀/재시도에는 최신 상태를 확인한다. 버튼 잠금과 무관하게 서버가 최종 제한을 적용한다. 조회 실패를 변경 가능 상태로 간주하지 않는다.
- 성공 시 프로필과 본인의 기존 게시물 alias/version만 원자적으로 갱신한다. 게시물 날짜·비율과 workspace v5/protocol 5·백업은 유지한다.
- 동시에 요청하면 하나만 적용한다. stale version은 거부하며 저장 응답 유실 후 같은 이름 재시도는 성공한 결과를 반환한다.

## 보안 범위

- 닉네임 등록/변경 입력은 정규화 전에 바이트/길이를 제한하고 서버 allowlist를 검증한다. SQL keyword blacklist를 만들지 않는다.
- 고정 SQL과 매개변수 RPC만 사용하며 사용자 입력을 SQL/HTML/URL로 실행하지 않는다. 닉네임·게시글은 React 텍스트로 렌더링한다.
- 인증 claim에서 본인 ID를 도출한다. 클라이언트가 owner ID·변경시각을 지정할 수 없다. FORCE RLS·직접 접근 차단·전용 최소권한 역할·빈 search_path를 유지한다.
- 프로필 trigger가 소유자/생성시각 변경과 48시간 우회를 거부하며 변경시각·version을 서버에서 설정한다. 변경 RPC에서 계정 잠금·version 비교·UNIQUE로 재전송/동시 변경을 처리한다.
- SQLi, stored XSS, 다른 계정 접근, 직접 테이블 쓰기, 시간 위조, 과대 입력, zero-width/control 문자, 동시 요청, 재전송을 DB/브라우저에서 검증한다. 애플리케이션 전체에 대한 침투 테스트나 DDoS 방어 보장은 이 변경의 범위가 아니다.

## 구현·검증

1. [x] profile v2/변경 RPC·trigger·migration·DB 경합/보존/공격 입력 테스트.
2. [x] 변경 UI·서버 기준 대기·실패/재시도·동일 이름 무변경·게시물 갱신.
3. [x] 최초 등록 안내·PRD·README·DESIGN·현재 spec 갱신.
4. [x] 타입·unit·DB·390/768/1280 focused·전체 E2E·build·직접 화면 검토.
5. [x] 운영 migration 보존 검사·PR·CI·배포·main/Orca 정리.

## 참고

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html): 고정 query와 매개변수, allowlist, 최소 권한.
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html): 사용자 입력은 텍스트로 렌더링하며 위험한 HTML sink를 사용하지 않는다.
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions): definer의 search_path와 실행 권한 제한.

현재 검증: 타입·harness·1,259 unit, 전체 PostgreSQL, Lounge focused 20개, build 및 화면 직접 검토 통과. 전체 E2E는 283 통과·기존 PWA 1 제외·기존 모션 측정 1 실패였고, 폰트 준비 후 측정하도록 수정한 해당 테스트가 5회 연속 통과했다. 운영 migration 보존·권한·SQL 일치 검사 완료. PR #28 병합·PR/main CI·Pages 배포와 실제 URL 확인 완료. 작업 브랜치 정리·main 동기화 완료, Orca 하위 작업공간 없음. [상세 검증 증거](../evidence/2026-09-28-lounge-nickname-change.md).
