# TODO

개인 작업 메모용 TODO입니다.

## Backlog
- [X] 모바일 환경 css 재구성
- [X] PWA 오프라인 캐시(Service Worker + manifest) 적용
- [X] 백업 저장소를 localStorage에서 IndexedDB로 확장(기존 백업 마이그레이션 포함)
- [X] 입력값/고급 설정 - 생활비 항목, 저축항목, 투자항목 탭 네비게이션 추가
- [ ] (보류) 자유적립식 적금, 파킹통장과 같이 목돈 예적금 성격 입력 체계
- [ ] (보류) 초기 투자/저축 기존 보유금액을 계좌별 보유금액 방식으로 전환
- [X] 적금/ISA 만기 해지월(YYYY-MM) 설정 옵션
- [X] 항목 정렬기능 - 기본, 금액 오름/내림, 이름 오름/내림
- [X] 하위 항목 그룹화 커스텀 - Sankey depth 확장(`생활비/공과금/관리비` 형태)
- [X] 모바일 PWA 신규 버전 감지/안내(standalone 실행 중 원격 manifest 버전 체크)
- [X] 모바일 PWA 버전 감지 주기 조정(포그라운드 복귀 + 1일 1회) 및 수동 최신버전 체크 버튼
- [X] 단일 레포 다중 단계 구조 전환(`apps/step1`, `apps/step2`, `shared`)
- [X] 공통 IndexedDB 허브 스키마 도입(`isf-hub-db-v1`: step1Snapshots/step2Portfolios/bridgeStep1ToStep2)
- [X] Step1 적용 시 Step2 브리지 payload 기록(월투자여력/현재자산/기준시점)
- [X] Step2 MVP: 포트폴리오 편집/비중검증/저장·불러오기/삭제 + Step1 데이터 수동 가져오기
- [X] Step2 계좌형 모델(v2) 전환: `accounts[] + unallocatedMonthlyInvest`
- [X] Step2 도넛 차트 탭(`종합/계좌별`) 및 계좌 카드형 미니 도넛 추가
- [X] Step2 기본 샘플 계좌/종목 구성(국내주식·ISA·해외주식)
- [X] Step2 v1(`targetAllocations`) -> v2 자동 마이그레이션
- [X] Step 공통 테마 CSS 도입(`shared/styles/step-theme.css`) 및 Step2 적용
- [X] Step2 입력 단순화: 월 투자 가능 금액 1개 + 계좌/종목 비중 조절 + 자동 현금 처리



# Bug


## 현재 진행중
- 보류 2건 외 백로그 기술 항목 1차 구현 완료
