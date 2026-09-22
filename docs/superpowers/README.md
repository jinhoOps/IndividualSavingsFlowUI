# Superpowers 문서 안내

현재 제품 기준은 [PRD](../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md), [DESIGN](../../DESIGN.md), 아래 보존 스펙과 최근 승인 스펙이다.

## 보관 기준

- 2026-09-22 정리 기준: **2026-09-08 이후**의 계획·스펙·검증 기록과 연결된 이미지를 유지한다.
- 2주보다 오래된 자료는 현재 구현의 필수 계약을 담은 스펙만 예외로 보존한다. 다음 정리 때도 날짜만으로 삭제하지 않고 대체 문서·미완료 작업·호환성 근거를 확인한다.
- `docs/superpowers/`와 `.superpowers/sdd/`의 완료된 과거 계획·작업 보고·검증 기록·스크린샷은 Git 이력에서 조회한다. 별도 archive 복사본을 쌓지 않는다. 과거 자료가 필요하면 보존된 고정 커밋 링크를 따른다.
- 최근 자료도 당시 상태의 기록이다. 최신 문서가 대체한 UI나 지원 종료 기능을 현재 요구사항으로 사용하지 않는다.
- 제품 코드·DB migration·호환성 테스트와 운영 백업은 문서 정리 대상이 아니다.

## 기간과 무관하게 보존하는 스펙

아래는 이번 보관 기간보다 오래됐지만 현재 필요한 계약이 남은 스펙이다. UI·저장 세대가 변경된 부분은 PRD와 최신 스펙을 우선한다.

| 스펙 | 보존 이유 |
| --- | --- |
| [신규 Simulation 복리 성장 시각화 설계](specs/2026-07-30-simulation-compound-growth-design.md) | 월 복리·명목/실질 계산과 Main 읽기 전용 경계 |
| [Journey Snapshot 폐기 설계](specs/2026-08-03-journey-snapshot-retirement-design.md) | 폐기된 전달 데이터·저장 키를 재도입하지 않는 계약 |
| [Portfolio 투자 배분 설계](specs/2026-08-03-portfolio-allocation-design.md) | 금액/비율 배분·현금 잔여·Main 변경 시 계산 규칙 |
| [Simulation 결과 중심 경험 재설계](specs/2026-08-03-simulation-experience-redesign-design.md) | 금액 표시 정밀도·Main 동기화·오류 복구 규칙 |
| [Simulation 모바일 그래프 상호작용 설계](specs/2026-08-05-simulation-mobile-chart-interaction-design.md) | 모바일 그래프 탐색·tooltip·접근성 규칙 |
| [Anime.js 공통 모션 시스템 설계](specs/2026-08-12-animejs-motion-system-design.md) | 공통 Anime.js 수명·취소·reduced motion 계약 |
| [Main setup 모션 복구와 조용한 인트로 건너뛰기 설계](specs/2026-08-14-main-setup-viewport-containment-design.md) | Main setup/review 모션 복구·viewport containment 계약 |
| [Repository Codex Harness Design](specs/2026-08-20-repository-codex-harness-design.md) | 저장소 검증 스킬이 직접 참조하는 CI·에이전트 규칙 |
| [Simulation 목표 도달 요약 설계](specs/2026-08-21-simulation-goal-milestone-design.md) | 월 단위 목표 도달 계산·목표 저장 및 09-11 확장 |
| [Simulation 단기 기간 월별 그래프 상세 설계](specs/2026-08-24-simulation-short-horizon-monthly-detail-design.md) | 단기 월별 그래프 탐색과 기존 연별 데이터 경계 |
| [Current Product Money Input Formatting Design](specs/2026-08-25-money-input-formatting-design.md) | 숫자 입력·IME·paste·커서와 저장값 보존 계약 |
| [Phase 4 Legacy Retirement Design](specs/2026-09-02-phase4-legacy-retirement-design.md) | 구 데이터·백업 변환·원문 보존과 폐기 근거 |
| [Account Map Planned Account Flow Design](specs/2026-09-04-account-map-planned-account-flow-design.md) | 지원 종료된 Account Map의 보존 데이터 의미·v4 호환성 |
| [Supabase 계정별 Workspace 저장 설계](specs/2026-09-07-supabase-account-workspace-design.md) | 계정 격리·동기화·미전송 복구·read-only 이전 기반 계약 |

## 최근 자료

- [Specs](specs/): 최신 기능·저장·UX 계약
- [Plans](plans/): 최근 구현 순서와 미완료 항목
- [Evidence](evidence/): 최근 검증 결과와 화면
- [이미지 공유 운영 기록](evidence/2026-09-22-result-card-storage-budget.md): 실제 48시간 관찰과 로컬 시험 컨테이너 종료 확인은 미완료 상태로 유지

## 과거 자료 조회

정리 전 전체 자료는 [고정 Git 스냅샷](https://github.com/jinhoOps/IndividualSavingsFlowUI/tree/abe6bccf1ffa4b41db26376a9754eab6aca5f265/docs/superpowers)에 남아 있다. 삭제 파일도 아래 명령으로 내용을 볼 수 있다.

```sh
git show abe6bccf1ffa4b41db26376a9754eab6aca5f265:docs/superpowers/plans/2026-08-06-shared-workspace-foundation.md
```
