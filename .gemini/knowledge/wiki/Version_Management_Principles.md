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
| **Patch** | `0.0.y` (Patch Up) | 버그 수정(`fix`), 스타일 수정(`style`), 단순 문서(`docs`). 실사용 중 발견된 이슈나 피드백을 신속히 반영할 때 사용. |

## 2. 패치 버전 운영 가이드 (Patch Lifecycle)
대규모 기능이 추가된 Minor Up(0.x.0) 이후에는 사용자 피드백과 실사용 데이터를 바탕으로 한 안정화 단계가 뒤따릅니다.
- **신속성**: 패치 버전은 기능의 큰 변화가 없으므로 메인 브랜치에서 직접 수정하거나 짧은 수명의 hotfix 브랜치를 통해 빠르게 반영합니다.
- **무결성**: 패치 버전이라 할지라도 '필수 동기화 지점'의 버전 정보는 반드시 일치시켜야 PWA 캐시 갱신이 정상적으로 이루어집니다.
- **누적**: 여러 개의 작은 버그 수정은 가급적 하나의 패치 버전(예: 0.7.2)으로 묶어서 배포하는 것을 지향하되, 치명적인 버그는 즉시 업데이트합니다.

## 3. 필수 동기화 지점 (The Triple Sync)
버전 업데이트 시 아래 3개 파일의 버전 정보는 반드시 일치해야 합니다.

1.  **`manifest.webmanifest`**: 브라우저 및 설치 환경에 앱 버전을 알립니다.
2.  **`sw.js`**: `APP_VERSION` 상수를 변경하여 서비스 워커가 이전 캐시를 삭제하고 새 자산을 로드하도록 강제합니다.
3.  **`apps/**/app.js`**: `IsfPwaManager` 인스턴스 생성 시 전달되는 `appVersion`으로, UI에서 사용자에게 현재 버전을 알리는 기준이 됩니다.

## 4. 자가 검증 프로토콜 (Self-Verification Protocol)
에이전트는 커밋 전 반드시 아래 명령어를 실행하여 버전 불일치를 확인해야 합니다.

```powershell
# 1. 프로젝트 전체의 버전 표기 현황 확인
grep -r "v0.7.2" .
grep -r "0.7.2" .

# 2. Triple Sync 지점 집중 확인
cat sw.js | select -first 10             # APP_VERSION 확인
cat manifest.webmanifest | select -first 10  # version 확인
grep "appVersion:" apps/step1/app.js
grep "appVersion:" apps/step2/app.js
```

## 5. 브랜치 및 PR 전략 (Branch & PR Workflow)
**Minor Up**(`0.x.0`)이 발생하는 대규모 작업(`feat`, 대규모 `refactor`)은 메인 브랜치 오염을 방지하고 무결성을 확보하기 위해 반드시 별도의 브랜치에서 진행합니다.

1.  **피처 브랜치 생성**: `feat/기능명` 또는 `refactor/작업명` 형식의 브랜치를 생성합니다.
2.  **독립 개발 및 검증**: 해당 브랜치 내에서 구현과 Evaluator 검증을 마칩니다. 메인 브랜치는 이 동안 안정 상태를 유지합니다.
3. **최종 버전 범프**: **Major/Minor 버전 범프(`0.x.0`)**는 반드시 PR이 승인(Approved)되고 메인 브랜치로 머지(Merge)되기 직전의 **최종 단계**에서만 수행합니다. 개발 진행 중이나 코드 리뷰 단계에서는 절대 버전을 올리지 않습니다. (단, Patch 버전은 개발 중에도 필요에 따라 업데이트 가능합니다.)
4.  **Pull Request**: 메인 브랜치로 PR을 생성하여 최종 코드 리뷰 및 머지를 진행합니다.

## 4. 기록 및 감사 (Audit Trail)
- **Log**: 모든 버전 변경은 `[[log.md]]`에 기록됩니다.
- **History**: 주요 마일스톤은 `[[Project_History.md]]`에 상세히 기술합니다.
- **Git**: Conventional Commits 규격을 준수하여 커밋 메시지만으로도 변경 사항을 추적할 수 있게 합니다.

## 4. 특이 사항 (No-build Invariant)
본 프로젝트는 별도의 빌드/번들링 과정이 없으므로, 소스 코드 자체의 버전이 곧 배포 버전입니다. 따라서 커밋 직전에 모든 동기화 지점을 확인하는 것이 무결성 유지의 핵심입니다.

---
*연결 노드:* [[Operating_Principles]], [[Project_History]], [[Architecture_Reference]]
