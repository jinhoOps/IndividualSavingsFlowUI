# External Integrations

**Analysis Date:** 2026-06-16

## APIs & External Services

**Browser APIs:**
- Clipboard API: [clipboard-parser.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/clipboard-parser.js)를 활용해 사용자가 복사한 한국 금융사(은행, 카드사 등)의 입출금 SMS/알림톡 텍스트 데이터를 클립보드에서 직접 읽고 가계부 데이터 형식으로 자동 파싱.
- Web Crypto API: [hub-storage.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/storage/hub-storage.js)에서 브라우저 보안 난수 생성기(`crypto.getRandomValues`)를 통해 고유한 스냅샷 및 엔트리 ID(`s1-*`, `ds-*`)를 생성하는 데 활용.
- Share API: [share-utils.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/core/share-utils.js)를 통해 시뮬레이션 결과 및 자산 데이터를 외부 메신저나 SNS로 텍스트 형식 전송.

## Data Storage

**Databases:**
- **IndexedDB (Browser Native)**
  - 로컬 브라우저 내장 데이터베이스로, 네트워크가 단절된 오프라인 환경에서도 원활하게 동작하는 로컬 퍼스트 아키텍처의 핵심 저장소.
  - **`isf-hub-db-v1` (DB_VERSION 2)**
    - 클라이언트: [hub-storage.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/storage/hub-storage.js)
    - 객체 스토어:
      - `step1Snapshots`: 가계 흐름 정보 스냅샷 저장. 최근 20개(`MAX_SNAPSHOTS = 20`)까지만 유지하며 초과 시 `updatedAt` 인덱스 기반으로 가장 오래된 스냅샷부터 자동 삭제(Limit enforcement).
      - `step2Entries`: 자산 포트폴리오 엔트리 저장.
    - 마이그레이션: `event.oldVersion < 2` 조건에서 기존 `step2Portfolios` 스토어에 잔존하던 데이터를 신규 스토어인 `step2Entries`로 자동 복제 및 이전 처리.
  - **`isf-backup-db-v1` (DB_VERSION 2)**
    - 클라이언트: [backup-manager.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/storage/backup-manager.js)
    - 객체 스토어:
      - `backupEntries`: 각 기능의 백업 히스토리 관리. 최대 60개(`MAX_BACKUP_ENTRIES = 60`)까지 백업 유지.
      - 인덱스: `app` 컬럼을 생성하여 앱 단계별(Step 1, Step 2 등) 백업을 구분 및 인덱싱.
    - 백업 간격 및 중복 방지: 자동 백업은 최소 12시간 주기(`AUTO_BACKUP_INTERVAL_MS`)로 제한하며, 데이터가 완전히 동일한 경우(`signature` 해시값 기반) 중복 저장을 차단.

**File Storage:**
- **LocalStorage:**
  - 사용자가 작업 중인 활성 뷰 데이터(Active View State), PWA 관리용 가시성 상태 플래그 등 저용량 키-값 데이터를 캐싱.
  - 브릿지 백업 패턴: `persistViewDataLocally` 호출 시 localStorage에 신규 데이터를 덮어쓰기 전에 기존 로컬 데이터를 `IsfBackupManager`를 통해 안전하게 IndexedDB 백업 스토어로 아카이빙.
- **Local JSON:**
  - [qqq_daily_chart.json](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/qqq_daily_chart.json) 등 정적 마켓 차트 데이터를 로컬 파일로 저장하여 필요 시 렌더링에 직접 로드.

**Caching:**
- **Cache Storage API (Service Worker):**
  - [sw.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/legacy/sw.js) 및 빌드 타임에 VitePWA 플러그인에 의해 제어되는 Service Worker가 JS, CSS, HTML, 웹 매니페스트, 로컬 이미지 등의 정적 자원을 브라우저 캐시에 저장하여 완전한 오프라인 작동을 지원.

## Authentication & Identity

**Auth Provider:**
- 없음 (완전한 로컬 퍼스트 아키텍처)
  - 별도의 원격 인증 서버가 존재하지 않으며, 사용자의 모든 자산 정보, 가계부 데이터, 백업 이력은 사용자의 로컬 브라우저 기기 샌드박스 내부(IndexedDB, LocalStorage)에만 저장됨.
  - 외부로 데이터를 전송하지 않음으로써 강력한 사용자 개인정보 보호(Privacy-by-Design) 구현.

## Monitoring & Observability

**Error & UI State Feedback:**
- [feedback-manager.js](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/shared/components/feedback-manager.js): 화면 상단에 커스텀 알림 배너 및 토스트 메시지를 띄워 데이터 로드 성공, 백업 완료, 에러 메시지 등을 사용자에게 시각적으로 즉시 피드백.
- Browser Console: 개발 중 디버깅 정보를 콘솔에 출력.

## CI/CD & Deployment

**Hosting:**
- **GitHub Pages**: 빌드된 정적 리소스들을 서비스하기 위해 GitHub Pages 호스팅 이용.
- 배포 서브패스 `/IndividualSavingsFlowUI/`에 대응하기 위해 `base` 경로를 설정하여 리소스를 라우팅함.

**CI Pipeline:**
- GitHub Actions: `.github/workflows/` 하위의 배포 워크플로우를 통해 코드가 push될 때 자동으로 빌드 테스트 후 GitHub Pages에 배포.

## Environment Configuration

**Required env vars:**
- 없음 (정적 단일 페이지 애플리케이션으로 동작).

**Secrets location:**
- 해당 없음 (민감한 API 키나 보안 토큰을 클라이언트 사이드에서 소유하지 않음).

---

*Integration audit: 2026-06-16*
