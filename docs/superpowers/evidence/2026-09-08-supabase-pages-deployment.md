# Supabase 계정 저장 Pages 배포

2026-09-08 사용자가 공개 사이트 반영을 요청해 main push와 GitHub Pages 배포를 수행했다. 기존 [v4 통합 기록](2026-09-08-supabase-workspace-v4-integration.md)의 미배포 상태를 잇는 후속 기록이다.

## 적용

- GitHub `github-pages` environment에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY` 공개 변수만 등록했다. DB 비밀번호·관리자 키는 등록하지 않았다.
- main `9e78ec2`를 push했고 [Pages 실행 34188817342](https://github.com/jinhoOps/IndividualSavingsFlowUI/actions/runs/34188817342)의 build·artifact·deploy가 모두 성공했다.
- 공개 주소는 [Main](https://jinhoops.github.io/IndividualSavingsFlowUI/apps/main/)이다. 별도 앱 서버 없이 기존 정적 배포를 유지한다.

## 검증

- 배포 전 `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·source/unit 타입 검사, 140개 파일·1,317개 테스트 통과.
- `npx vite build` 통과. GitHub Actions에서도 실제 공개 변수로 production build와 Pages 배포 성공.
- 테스트용 로컬 서버나 HTTP mock 없이 위 공개 주소를 실제 Chromium 두 문맥에서 실행했다. 일회성 테스트 계정으로 Main 저장·두 번째 브라우저 focus 갱신·reload와 네 제품 직접 진입이 통과했다.
- 공개 Account Map에서 native fixed/sweep 유지와 Main overlay 저장을 확인했다. `save_main`만 호출하고 실제 DB revision이 한 번 증가하며 Account Map은 보존됐다. 두 번째 브라우저에도 같은 Main 값이 반영됐다.
- 실제 대상 계정의 이메일·비밀번호 로그인, 최초 계획 선택 화면과 로그아웃이 통과했다. 작업 전후 workspace fingerprint는 동일했고 대신 금융 계획을 만들거나 가져오지 않았다.
- 실제 Supabase 170 validator fixture, 여섯 RPC, 구 protocol 차단, CAS·중복 재시도·동시성·권한 격리를 재확인했다. 네 migration의 운영 history와 소스 hash가 일치했다.
- 정확한 일회성 테스트 계정·workspace·receipt만 삭제하고 잔여 행이 없음을 확인했다. 실제 대상 계정은 보존했다.

## 사용자 시작과 남은 범위

기존 데이터를 입력했던 브라우저에서 공개 Main에 이메일·비밀번호로 로그인하고 **이 브라우저 계획 가져오기**를 선택한다. 기존 원본은 보존하며 자동 업로드하지 않는다. 다른 브라우저에서 같은 계정으로 로그인하면 서버에 저장한 계획을 조회한다. 가져오기 전 브라우저 저장소를 삭제하지 않는다.

Google provider 설정과 실제 Google 왕복은 아직 미완료이므로 임시 이메일 로그인을 사용한다. 비밀번호 교체와 세션 만료·기존 설치 PWA 업데이트의 사용자 환경 검증은 [운영 안내](../../supabase-account-setup.md)를 따른다. 기존 개발 의존성 audit와 Minor 충돌 화면 후속 사항은 v4 통합 기록에 유지한다. 이 후속 문서 커밋은 앱·SQL·lockfile을 변경하지 않는다.
