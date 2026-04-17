---
type: node
created: 2026-04-17
status: evergreen
tags: [governance, versioning, pwa, workflow]
---

# 📌 Version Management Principles (버전 관리 원칙)

IndividualSavingsFlowUI 프로젝트의 버전 관리 및 PWA 동기화 표준 지침입니다.

## 1. 버전 번호 체계 (Versioning Strategy)
프로젝트는 정식 릴리스 전까지 `0.x.y` 체계를 따르며, 작업의 영향도에 따라 결정합니다.

| 변경 유형 | 버전 범프 | 예시 |
| :--- | :--- | :--- |
| **Major/Minor** | `0.x.0` (Minor Up) | 새로운 기능(`feat`), 대규모 리팩터링, 스키마 변경 |
| **Patch** | `0.0.y` (Patch Up) | 버그 수정(`fix`), 스타일 수정(`style`), 단순 문서(`docs`) |

## 2. 필수 동기화 지점 (The Triple Sync)
버전 업데이트 시 아래 3개 파일의 버전 정보는 반드시 일치해야 합니다.

1.  **`manifest.webmanifest`**: 브라우저 및 설치 환경에 앱 버전을 알립니다.
2.  **`sw.js`**: `APP_VERSION` 상수를 변경하여 서비스 워커가 이전 캐시를 삭제하고 새 자산을 로드하도록 강제합니다.
3.  **`apps/**/app.js`**: `IsfPwaManager` 인스턴스 생성 시 전달되는 `appVersion`으로, UI에서 사용자에게 현재 버전을 알리는 기준이 됩니다.

## 3. 기록 및 감사 (Audit Trail)
- **Log**: 모든 버전 변경은 `[[log.md]]`에 기록됩니다.
- **History**: 주요 마일스톤은 `[[Project_History.md]]`에 상세히 기술합니다.
- **Git**: Conventional Commits 규격을 준수하여 커밋 메시지만으로도 변경 사항을 추적할 수 있게 합니다.

## 4. 특이 사항 (No-build Invariant)
본 프로젝트는 별도의 빌드/번들링 과정이 없으므로, 소스 코드 자체의 버전이 곧 배포 버전입니다. 따라서 커밋 직전에 모든 동기화 지점을 확인하는 것이 무결성 유지의 핵심입니다.

---
*연결 노드:* [[Operating_Principles]], [[Project_History]], [[Architecture_Reference]]
