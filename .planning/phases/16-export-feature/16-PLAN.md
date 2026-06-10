# Phase 16 Plan: Export Feature

- **Target Milestone:** v1.6 (코드 리팩터링, UX 개선 및 안정성 강화)
- **Phase:** 16 (Export Feature)
- **Status:** PLANNING
- **Created:** 2026-06-10
- **Last Updated:** 2026-06-10

---

## 🏗️ 1. Implementation Steps (구현 단계)

### Step 1.1: UI 마크업 추가 (`apps/step1/index.html`)
- **대상**: [index.html](file:///D:/jhkSandBox/CODE/IndividualSavingsFlowUI/apps/step1/index.html#L85-L93)
- **변경 사항**: `<div class="sankey-zoom-tools">` 요소 내부 `#sankeyZoomLabel` 오른쪽에 이미지 다운로드 버튼(`#sankeyExport`)을 추가합니다.
- **코드 설계**:
  ```html
  <button id="sankeyExport" class="btn btn-ghost btn-sm sankey-export-btn" type="button" aria-label="Sankey Diagram 이미지 저장">
    <svg class="icon icon-export" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    <span>이미지 저장</span>
  </button>
  ```

### Step 1.2: CSS 스타일링 정의 (`apps/step1/styles.css`)
- **변경 사항**: `.sankey-export-btn` 전용 호버 효과 및 SVG 아이콘 정렬 스타일 정의.
- **물리적 무결성 검증**: CSS 파일 하단의 `@media` 미디어 쿼리가 손상되지 않도록 끝 부분에 외과적으로 추가합니다.

### Step 2.1: 내보내기 모듈 추가 (`apps/step1/modules/sankey-renderer.js`)
- **변경 사항**: SVG 요소를 PNG 이미지로 네이티브 브라우저 API를 사용해 변환하고 파일 다운로드를 실행하는 `exportSankeyToPng` 함수를 구현하여 export합니다.
- **함수 구조 설계**:
  ```javascript
  export function exportSankeyToPng() {
    const svgEl = dom.sankeySvg;
    if (!svgEl) return;
    
    // 1. 크기 계산
    const rect = svgEl.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;
    
    // 2. SVG 복제
    const clone = svgEl.cloneNode(true);
    
    // 3. 스타일 주입 (외부 폰트 및 그라데이션 색상 강제 인라인화)
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap');
      svg {
        font-family: 'Gowun Dodum', sans-serif;
        background-color: transparent;
      }
      text {
        fill: #334155;
        font-size: 12px;
      }
      .sankey-path {
        fill: none;
        stroke-opacity: 0.4;
      }
      /* 기타 그라데이션 및 색상 변수 직접 선언 */
      :root {
        --tone-sunset: #ea5b2a;
        --tone-deepsea: #1e293b;
      }
    `;
    clone.insertBefore(styleEl, clone.firstChild);
    
    // 4. XMLSerializer로 직렬화
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    
    // 5. Blob 생성 및 이미지 로드
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // 6. 2배 해상도 캔버스 설정
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      
      // 배경 투명 또는 흰색 채우기 (투명도 보존을 위해 투명 처리)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      
      // 7. PNG 다운로드 실행
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadLink.href = pngUrl;
      downloadLink.download = `isf-sankey-${today}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // 8. 메모리 해제
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  ```

### Step 3.1: 이벤트 핸들러 바인딩 (`apps/step1/app.js`)
- **변경 사항**: `app.js`에서 UI 버튼 `#sankeyExport`를 찾아 클릭 시 `exportSankeyToPng()`를 실행하는 이벤트 바인딩 로직을 추가합니다.
- **물리적 무결성**: 파일의 기존 import 구문 및 하단 헬퍼 함수가 덮어써지지 않도록 마운트 및 셋업 구역(`setupEventListeners` 등)에 안전하게 코드를 주입합니다.

---

## 🧪 2. Verification Plan (검증 계획)

### 2.1 로컬 검증 시나리오
- **Vite 개발 서버 구동**: `npm run dev`
- **검증 항목**:
  1. `#sankeyExport` 버튼 존재 확인.
  2. 버튼 클릭 시 크롬 브라우저 하단에 파일(`isf-sankey-YYYYMMDD.png`) 다운로드 팝업이 노출되는가?
  3. 다운로드된 이미지 파일이 정상적으로 열리는가?
  4. 이미지 화질이 흐릿하지 않고 2배 고해상도로 텍스트와 그라데이션이 선명하게 노출되는가?
  5. 한국어 폰트가 깨지지 않고 Gowun Dodum 등의 스타일이 적용되어 있는가?
  6. 모바일 해상도(760px 이하) 환경에서도 버튼이 깨지지 않고 툴바가 한 줄로 유지되는가?

### 2.2 빌드 검증 시나리오
- **프로덕션 빌드 실행**: `npm run build`
- **검증 항목**:
  1. Vite 빌드가 경고나 에러 없이 정상 완료되는가?
  2. 빌드된 산출물(`.html`, `.js`, `.css`)에서 다운로드 및 렌더링 무결성이 완전히 보장되는가?
