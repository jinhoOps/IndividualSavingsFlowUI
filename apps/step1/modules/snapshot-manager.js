import { sanitizeInputs, cloneInputs } from "./input-sanitizer.js";

/**
 * Step 1의 전체 데이터를 통합 저장소(Storage Hub)의 스냅샷으로 저장합니다.
 * 이 데이터는 Step 2에서 연동하여 사용될 수 있습니다.
 */
export async function persistStep1Snapshot(inputs, { getHubStorage, isViewMode }) {
  const hub = getHubStorage();
  if (!hub || isViewMode) {
    return;
  }
  try {
    const safeInputs = sanitizeInputs(cloneInputs(inputs));
    await hub.saveStep1Snapshot(safeInputs);
  } catch (_error) {
    // 스냅샷 저장 실패가 메인 흐름에 영향을 주지 않도록 예외 처리
  }
}
