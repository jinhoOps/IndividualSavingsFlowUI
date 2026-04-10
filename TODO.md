---
kanban-plugin: basic
---

# TODO

## Backlog
- [ ] (보류) 자유적립식 적금, 파킹통장과 같이 목돈 예적금 성격 입력 체계
- [ ] (보류) 초기 투자/저축 기존 보유금액을 계좌별 보유금액 방식으로 전환
- [ ] step 1 sankey diagram 확대배율 축소기능, 모바일 가로모드일때 한 화면에서 확인 불가.
- [ ] (all) 사용자 커스텀 - 항목별 텍스트 색상 및 중요도(Priority) 표시 기능 추가
- [ ] 모바일환경에서 뒤로가기 하면 이전페이지가 떠서 종료가 쉽지않음
- [x] step2 자산군-> 종목 으로 명칭변경
- [x] step2 종목 구성 순서 변경 기능 (드래그 앤 드롭 & 롱프레스)
- [x] 종합 도넛 포트폴리오 가시성 개선 (1%이하 그룹화 및 라벨링)

## Done
- [X] persistBackupEntries 고아 데이터 삭제 동기화 로직 추가
- [X] PWA 업데이트 자동 백업 시 빈 배열 로드 버그 수정 및 동적 appKey 적용
- [X] Step2 공유 링크 기능에 IsfShare 인코딩(LZ 압축) 공통 유틸리티 적용
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
- [ ] step2에서 step1으로 이동시 포트폴리오 도넛이 제대로 표시되지 않음

%% kanban:settings
```
{"kanban-plugin":"basic"}
```
%%

