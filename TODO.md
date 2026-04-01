---
kanban-plugin: basic
---

# TODO

## Backlog
- [ ] (보류) 자유적립식 적금, 파킹통장과 같이 목돈 예적금 성격 입력 체계
- [ ] (보류) 초기 투자/저축 기존 보유금액을 계좌별 보유금액 방식으로 전환
- [ ] step 1 sankey diagram 확대배율 축소기능, 모바일 가로모드일때 한 화면에서 확인 불가.

## Done
- [X] 기능 검증 (버전 업그레이드 시뮬레이션 및 백업 확인)
- [X] PWA 업데이트 전 자동 데이터 백업 및 업데이트 진행 (SW 제어 및 BackupManager 연동)
- [X] 모바일 환경 css 재구성
- [X] PWA 오프라인 캐시(Service Worker + manifest) 적용
- [X] 백업 저장소를 localStorage에서 IndexedDB로 확장(기존 백업 마이그레이션 포함)
- [X] 입력값/고급 설정 - 생활비 항목, 저축항목, 투자항목 탭 네비게이션 추가
- [X] 적금/ISA 만기 해지월(YYYY-MM) 설정 옵션
- [X] 항목 정렬기능 - 기본, 금액 오름/내림, 이름 오름/내림
- [X] 하위 항목 그룹화 커스텀 - Sankey depth 확장(`생활비/공과금/관리비` 형태)
- [X] 모바일 PWA 신규 버전 감지/안내(standalone 실행 중 원격 manifest 버전 체크)
- [X] 모바일 PWA 버전 감지 주기 조정(포그라운드 복귀 + 1일 1회) 및 수동 최신버전 체크 버튼
- [X] 단일 레포 다중 단계 구조 전환(`apps/step1`, `apps/step2`, `shared`)
- [X] 공통 IndexedDB 허브 스키마 도입(`isf-hub-db-v1`: step1Snapshots/step2Portfolios/bridgeStep1ToStep2)
- [X] Step1 적용 시 Step2 브리지 payload 기록(월투자여력/현재자산/기준시점)
- [X] 샘플/초기화 기능 실행 시 기존 데이터 덮어쓰기 방지(Confirm 대신 View 모드 연동으로 안전하게 진입)
- [X] 공유/샘플 로드 시에만 URL 해시를 활용하고, 일반 모드에서는 URL을 깔끔하게 정리(로컬 스토리지 단일 저장)

# Bug
- (현재 리포트된 버그가 없습니다)

%% kanban:settings
```
{"kanban-plugin":"basic"}
```
%%

