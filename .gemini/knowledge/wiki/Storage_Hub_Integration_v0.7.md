---
type: node
created: 2026-04-23
tags: [storage, architecture, indexeddb, refactoring, v0.7.0]
---

# Storage Hub Integration (스토리지 허브 통합 상세)

v0.7.0 리팩터링을 통해 도입된 `IsfStorageHub` 중심의 통합 데이터 관리 체계에 대한 기술적 명세입니다.

## 1. 배경 및 목적
- **파편화 해소**: Step 1과 Step 2가 각자 LocalStorage와 IndexedDB를 다루던 로직을 하나로 통합.
- **데이터 정합성**: `modelVersion: 10` (원 단위 정규화) 정책의 엄격한 준수.
- **안전성 강화**: 데이터 덮어쓰기 전 자동 백업 트리거링 의무화.

## 2. 핵심 아키텍처: `IsfStorageHub`
`shared/storage/hub-storage.js`에 위치하며, 다음과 같은 역할을 수행합니다.

### 주요 기능
- **통합 스토리지 API**: `saveSnapshot`, `loadSnapshot`, `savePortfolio`, `listPortfolios` 등 도메인 특화 메서드 제공.
- **LocalStorage & IDB 동기화**: `lastSnapshot` 등 핵심 상태는 LocalStorage에, 상세 이력 및 포트폴리오는 IndexedDB에 분산 저장하되 API는 하나로 제공.
- **백업 오케스트레이션**: 데이터 변경 시 `BackupManager`와 연동하여 자동 백업 실행 및 복원 관리.
- **트랜잭션 안전성**: 내부 `perform(storeName, mode, callback)` 헬퍼를 통해 IndexedDB 트랜잭션의 열기/닫기/에러 처리를 캡슐화.
- **독립성 확보**: `_createId` 내부 헬퍼를 도입하여 `IsfUtils` 로드 전에도 ID 생성이 가능하도록 설계 (v0.7.1).

## 4. 데이터 마이그레이션 (v0.7.1 추가)
Step 2 리브랜딩으로 인한 스토리지 키 변경 시 데이터 단절을 방지하는 메커니즘입니다.

### 4.1 LocalStorage 마이그레이션
- `ensureMigration(oldKey, newKey)` 호출 시, `oldKey`에 데이터가 있고 `newKey`가 비어있다면 데이터를 복사합니다.

### 4.2 백업 이력 마이그레이션 (IndexedDB)
- `IsfBackupManager.migrateAppKey(oldKey, newKey)`를 통해 IndexedDB 내의 `backupEntries` 중 `app` 필드가 구버전인 항목들을 신버전으로 일괄 업데이트합니다.

### 4.3 실행 시점
- Step 2 앱 초기화 시(`initializeBackupStore`) 비동기로 1회 실행됩니다.

## 5. 뷰 모드 안전 저장 프로토콜
공유 받은 데이터를 내 기기에 저장할 때의 절차입니다.
1. **백업 생성**: `BackupManager.createManualBackup('auto/view-save')`를 호출하여 현재 로컬 상태 보존.
2. **데이터 덮어쓰기**: `IsfStorageHub.persistViewDataLocally(data)`를 통해 새로운 데이터 반영.
3. **상태 갱신**: UI 리로드 및 저장 성공 알림.

## 5. 구현 패턴 (Code Example)
```javascript
// IsfStorageHub를 이용한 안전한 저장 예시
async function handleSave() {
    try {
        const data = prepareData();
        await IsfStorageHub.saveSnapshot(data);
        IsfFeedback.notifyAutoSave('success');
    } catch (error) {
        IsfFeedback.notifyAutoSave('error');
        console.error('Save failed:', error);
    }
}
```

---
*연결 노드:* [[Architecture_Reference]], [[Data_Model_Reference]], [[log]]
