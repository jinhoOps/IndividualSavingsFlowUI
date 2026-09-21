# Responsive Experience Implementation Plan — 총괄

> **For agentic workers:** 계획 승인 후 `superpowers:executing-plans`로 A→B→C 순서대로 수행한다. 각 세부 계획은 자체 테스트 주기를 가진다. 이번 요청은 계획 작성이며 제품 구현·커밋·배포를 포함하지 않는다.

**Goal:** 세 앱의 웹 중앙 모달·모바일 하단 시트·행동 배치를 통일하고, 결과를 읽은 뒤 샘플 탐색과 종합 이미지 보관으로 이어지게 한다.
**Architecture:** 공통 표면은 표시·focus·종료만, 앱은 draft·검증·저장만 소유한다. 기존 Main 하단 탐색을 Simulation에 확장한다. 이미지 출력은 하나의 확정 workspace snapshot에서 생성하는 읽기 전용 모듈이다.
**Tech Stack:** React, TypeScript, native dialog, 기존 CSS·Anime.js, SVG/Canvas/PNG, Vitest, Playwright. C의 링크 공유에만 Supabase private Storage·공유 전용 migration·Edge Functions·Cron을 추가한다.
**Spec:** [전체 설계](../specs/2026-09-21-responsive-overlays-and-result-card-design.md).
**Status:** 계획 제안 / 기준 `7c22487d` / 2026-09-21.

## Global Constraints

- Main 소유 월간 다섯 값, Simulation/Portfolio의 자기 slice만 쓰는 계약을 유지한다.
- schema v5·protocol 5, accountMap/locations 보존, 원자적 whole-workspace 복원은 변경하지 않는다.
- 새 breakpoint: 767px 이하 sheet, 768px 이상 중앙 modal. 해당 변경을 PRD·DESIGN·관련 spec과 동시에 반영한다.
- 주요 행동 오른쪽·라벨 왼쪽·조작 오른쪽, 최소 44px touch target. back은 왼쪽, 광폭 단독 CTA도 허용한다.
- 각 단계 완료 전 저장 실패·취소·focus 복원과 390/768/desktop을 검증한다. 화면 캡처만으로 저장 정확성을 주장하지 않는다.
- 커밋이 승인된 실행에서는 `git var GIT_AUTHOR_IDENT`로 `KIM JINHO <okho04@gmail.com>`을 확인하고 해당 단계 파일만 stage한다.
- 기존 미추적 `2026-09-16-portfolio-editor-hierarchy.md`를 변경하거나 이번 작업에 포함하지 않는다.

## Review Focus

1. 열린 모달에서 폭/키보드/브라우저 Back이 바뀜 → 입력과 반환 위치 유지. A1/A2/A3에서 검증.
2. 설정에서 로그아웃·세션 만료·오프라인 발생 → 모달이 계정 복구를 막지 않음. A4 및 최종 cloud 회귀.
3. Simulation raw 오류·500ms 자동 저장 대기·외부 Main 변경 → 적용/취소/CTA에 이전 값이 섞이지 않음. B1/B2.
4. 결과 카드의 source 불일치·다른 탭 저장 → 하나의 확정 revision으로만 생성. C1/C3.
5. 최대 10개 대상+현금·긴 이름·금액 숨김·iOS 공유 취소 → 잘림/누출/허위 성공 없음. C2/C3.

## 순서와 독립 배포 단위

| 단계 | 문서 | 산출물 | 선행 조건 |
| --- | --- | --- | --- |
| A / 최우선 | [모달·설정·행동 배치](2026-09-21-responsive-surfaces.md) | Main/Portfolio 우측 패널 제거, 공통 설정 표면 | 본 설계 방향 |
| B / 다음 | [Simulation 편집·하단 탐색](2026-09-21-simulation-edit-and-discovery.md) | 조건 편집 sheet/modal, 결과 끝의 Portfolio CTA | A의 공통 dialog |
| C / 별도 기능 | [3:4 결과 이미지](2026-09-21-financial-result-image.md), [48시간 링크 공유](2026-09-21-result-image-link-sharing.md) | 하단 저장/공유 버튼·미리보기·PNG·48시간 링크 | A의 공통 dialog, B의 확정 결과 저장 의미 |

A는 B/C 없이 출시 가능한 UX 수정이다. C 때문에 A를 지연시키지 않는다. 단계 내부에서도 공통 shell → Main → Portfolio → 설정 순으로 적용해 한 번에 focus 시스템을 두 개 교체하지 않는다. 동일 저장/focus 파일을 여러 작업자가 동시에 변경하지 않는 직렬 실행을 기본으로 한다.

## 결정한 기본값

- 설정은 웹 중앙 모달/모바일 하단 시트로 선택한다. 우측 viewport-clamped popover 대안은 설계 문서에 비교 기록만 둔다.
- Simulation은 `조건 편집 → 미리보기 → 적용`으로 통일한다. 결과의 명목/실질만 기존 직접 조작을 유지한다.
- 5/9/13만 기존 샘플 매핑, 다른 rate는 전체 샘플. 수익률 근접도 계산은 추가하지 않는다.
- 3:4 이미지의 원화 표시 초기값은 현재 Portfolio 보기 설정을 따르며 export 옵션은 원래 설정을 변경하지 않는다.
- 종합 카드 1차는 세 앱의 유효한 확정 상태를 요구한다. Portfolio 하단에 윤곽 없는 `저장하기`/`공유하기`를 둔다. 공개 열람은 생성된 이미지의 48시간 링크로 한정한다. 13개 지출 상세·템플릿 꾸미기는 추가하지 않는다.

## 최종 결합 검증

- [ ] `npm run check` / `npm run test:unit` 통과.
- [ ] `npm run test:e2e -- --reporter=line` 전체 실행. skip 사유를 별도 기록.
- [ ] 320×568, 390×844, 390×600, 767×900, 768×1024, 1024×600, 1280×900, 1440×900에서 panel 부재·modal center·body scroll·focus·target·시각화 가시성 확인.
- [ ] 200% 확대, reduced motion, 키보드 Tab/Shift+Tab/Escape/Back, touch graph/slider와 하단 탐색 충돌 확인.
- [ ] iOS Safari/Android Chrome 실기기 키보드·safe area·share/download, VoiceOver/TalkBack 수동 검증. 미수행은 미검증으로 명시.
- [ ] Main 적용 → Simulation 조건 취소/적용 → 하단 샘플 열기 → Portfolio 초안 취소/적용 → 카드 저장으로 이어지는 전체 여정 확인.
- [ ] 카드 PNG 치수·전 항목·계산값·금액 숨김·실패 복구 확인. 원본과 390px 축소 보기 직접 검사.
- [ ] 공유 생성 인증·비로그인 열람·48시간 경계·캐시 우회·자동 삭제와 재시도·workspace revision 보존 확인. 운영 Cron 실행 증거 없이 공유 배포 완료로 표시하지 않는다.
- [ ] PRD/README/DESIGN·superseded spec 상태·상대 링크·`git diff --check` 확인.
- [ ] 제품/UX 담당자가 설계 §8의 짧은 과제로 설명 없이 편집/복귀/샘플/저장을 이해하는지 재확인.

## 이번 계획 작업의 확인 범위

현재 코드/문서와 합성 데이터의 로컬 호환성 entry를 확인했다. [관찰 증거](../evidence/2026-09-21-responsive-overlays/README.md)에 PNG 5장, Simulation AX 확인·캡처 실패, 3:4 정보 배치 구상을 구분해 기록한다. 새 UI는 구현하지 않았으므로 이 체크리스트를 통과로 표시하지 않는다.

**다음 소유자:** 구현 담당자. A 계획의 Task A1부터 시작하고 단계마다 최신 검증 증거를 이 총괄 계획에 연결한다.

## 계획 산출물 검증 — 2026-09-21

- 문서 6개의 상대 링크 27개 존재 확인: PASS.
- `git diff --check` 및 각 새 Markdown에 대한 `git diff --no-index --check /dev/null <file>`: PASS.
- placeholder 검색과 기존 수정 대상 파일 존재 확인: PASS.
- PRD/README/DESIGN 현재 계약과 대조: panel/breakpoint/자동저장/새 export는 제안으로 구분했으며 현재 완료 상태를 덮어쓰지 않았다.
- 3:4 구상 PNG 1080×1440 생성·직접 시각 확인: PASS. 최대 대상·실제 파일 공유까지 검증한 제품 결과는 아니다.
- 제품 소스 변경 없음. 타입 검사·단위/E2E는 이번 문서 작업에서 실행하지 않았다. Simulation PNG/실기기·계정 상태 확인의 한계는 evidence에 기록했다.
