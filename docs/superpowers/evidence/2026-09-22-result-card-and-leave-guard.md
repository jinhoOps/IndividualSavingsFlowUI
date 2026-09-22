# 공유 이미지와 이탈 확인 수정 검증

기준: `ff29f5a3`. 사용자 VOC: 공유 이미지의 글자 늘어짐·겹침, 조회 또는 서버 저장 완료 후 불필요한 이탈 확인.

## 원인과 수정

- SVG의 모든 투자 대상명에 강제하던 `textLength=360 / spacingAndGlyphs`를 제거했다. 원래 글자 비율을 유지하고 긴 이름은 grapheme 단위로 최대 두 줄·말줄임 처리한다.
- 미래 자산 두 항목이 같은 y 좌표에 겹치던 오류를 수정했다. 배분 영역을 넓혀 최대 10개 대상과 현금의 이름·비율·금액을 분리했다.
- 이미지 옵션 변경 즉시 이전 PNG의 저장·공유를 비활성화하고, 재생성 중에도 미리보기 공간을 유지한다.
- 계정 전체의 input/change 이벤트를 수정으로 간주하던 처리를 제거했다. 이탈 판단은 실제 복구 초안, 아직 앱 초안에 반영되지 않은 입력, 서버 요청 대기·실패를 기준으로 한다.
- Main 대시보드는 다섯 금액을 비교해 원래 값으로 복원하면 clean 상태가 된다. 재설정 초안은 별도 저장이 확정될 때까지 보호한다.
- 샘플 조회·표시 옵션은 clean 상태를 유지한다. 실제 샘플 비율 변경, Main 초과 배분 입력, Simulation 미완료/잘못된 입력, Portfolio 항목·현금 입력은 보호한다.
- Portfolio 현금 반영 후 소비한 raw 입력을 정리해 비율 저장의 반올림 차이가 미저장 경고를 남기지 않게 했다.
- 전체 E2E에서 발견한 공통 dialog의 지연 focus 복원도 수정했다. 닫은 뒤 사용자가 다른 버튼으로 옮긴 focus는 보존하고, body 등에 focus가 남았을 때만 원래 버튼으로 복원한다.

## 검증

- 수정 전 브라우저에서 금 한 글자의 폭이 360px인 것을 측정하고, 이미지 옵션만 바꾼 뒤 beforeunload가 차단되는 실패를 재현했다.
- 수정 전 실패한 회귀 테스트로 Main 원래 금액 복원, 복구 초안 재접속, 남는 돈 초과 입력, 재설정 저장 대기, Simulation 수익률 입력, Portfolio 현금 반올림을 확인했다.
- `npm run check:ci`: harness·TypeScript·단위 테스트 1,110개 통과.
- Supabase fixture 환경으로 `npx vite build`: 통과.
- 별도 읽기 전용 리뷰의 네 가지 지적을 수정하고 재검토: 추가 차단 사항 없음.
- 첫 전체 E2E: 228 통과·1 skip·1 실패. 실패한 `app-journey.spec.ts:565`는 별도 실행에서도 동일하게 재현했다. 원인은 dialog 닫기 뒤 RAF/timer의 강제 focus 복원이었다. 수정 후 같은 테스트 1개 통과.
- 최종 `npm run test:e2e -- --workers=2 --reporter=dot`: **229 통과·1 skip·실패 0** (5.2분). skip은 service worker를 차단하는 일반 E2E 프로젝트에서 제외하는 PWA offline 전용 gate다.
- 공통 focus 수정 뒤 `npm run check:ci`를 재실행해 **1,110 통과**를 확인했고, 환경 변수를 지정한 배포 빌드도 다시 통과했다. `git diff --check`와 변경 문서의 상대 링크 확인도 통과했다.

## 시각 증거

실제 SVG → PNG 경로로 만든 1080×1440 파일과 공유 미리보기를 직접 확인했다. 금액/비율 모드의 모든 텍스트 bounding box가 이미지 안에 있으며 서로 겹치지 않는지 브라우저에서 검사한다.

- [금액 포함, 10개 대상과 현금](2026-09-22-result-card-and-leave-guard/card-amounts.png)
- [금액 제외, 10개 대상과 현금](2026-09-22-result-card-and-leave-guard/card-ratios.png)
- [390px](2026-09-22-result-card-and-leave-guard/preview-390.png)
- [768px](2026-09-22-result-card-and-leave-guard/preview-768.png)
- [1280px](2026-09-22-result-card-and-leave-guard/preview-1280.png)

## 호환성과 범위

- schema v5, protocol 5, 보관 중인 accountMap/locations, whole-workspace 백업 형식은 변경하지 않았다.
- transient 입력 추적은 컴포넌트 생명주기 안에서만 유지한다. 기존 복구 초안과 서버 저장 payload의 일치 여부를 확인하는 계약을 유지한다.
- 서버 저장 완료 후 페이지 이탈은 막지 않는다. 편집기 안의 명시적인 초안 폐기 확인과 저장 실패 보호는 유지한다.
- 이미 발행한 공유 링크의 PNG는 불변이다. 수정된 이미지는 새로 저장·공유해야 반영된다.
