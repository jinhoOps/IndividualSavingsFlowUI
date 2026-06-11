# Phase 15: Chart Enhancement & Responsive - Plan

본 문서는 Phase 15 (Sankey Chart 데이터 라벨링 및 모바일 레이아웃 고도화)를 안전하고 확실하게 구현하기 위해 작성된 실행 상세 기획서입니다.

---

## 1. 개요 및 마일스톤 정합

- **목적**: Sankey Chart의 모바일 겹침 현상을 원천 방지하고, Sunset/Deep Sea 그라디언트를 적용하여 프리미엄 비주얼을 선사하며, 768px 이하 모바일 화면의 가로 폭 100% 내에 깨짐 없이 완벽히 정착되도록 레이아웃 무결성을 고도화합니다.
- **주요 관련 요구 사항**: UX-03 (반응형 무결성), UX-05 (차트 데이터 라벨링 가독성 고도화)

---

## 2. 작업 체크리스트 (Task List)

### [Task 1] [BLOCKING] Sunset/Deep Sea 그라디언트 링크 렌더링 구현
- [ ] `renderSankey` 함수 시작부에 `<defs>` 블록 동적 삽입 로직 추가.
- [ ] Sunset(#ea5b2a)에서 Deep Sea(#1e8b7c)로 부드럽게 이어지는 `linearGradient` 요소 정의.
- [ ] SVG Path(`sankey-path`) 엘리먼트 렌더링 루프 시 `stroke="url(#isf-sankey-sunset-deepsea-gradient)"` 지정.
- [ ] 마우스 호버(`mousemove`) 및 퇴장(`mouseleave`) 시 부드러운 불투명도(Opacity) 제어 인터랙션 구현.
- [ ] **Verify**: 브라우저 개발자 도구의 Elements 패널에서 SVG 내부에 `<defs>`가 1회만 올바르게 생성되고, 모든 path에 gradient url이 매핑되어Sunset->Deep Sea 시각 효과가 WOW 수준으로 흐르는지 검증.

### [Task 2] [BLOCKING] 모바일 배지형(말풍선) 라벨 및 수치 렌더링 구현
- [ ] `drawNode` 시그니처에 `isMobileViewport` 매개변수 바인딩 추가 및 `renderSankey` 호출부에서 전달 연동.
- [ ] 모바일(`isMobileViewport === true`) 시, 노드 가로 중앙 상단에 배지 스타일로 텍스트 배치되도록 X/Y 좌표 계산 오버라이드.
  - X: `node.x + node.w / 2` (앵커: `middle`)
  - Y: 1행(라벨) `node.y - 18`, 2행(수치) `node.y - 6` (showValue가 활성화된 경우)
- [ ] 텍스트 뒤에 둥근 모서리(`rx="4" ry="4"`)를 지닌 가독성 전용 미니 `<rect>` 배경 박스 삽입 로직 구현.
  - 가로 너비: 라벨명과 수치 중 더 큰 문자열 너비 + 패딩 여유분(8px)
  - 세로 높이: 2행 일 때 `26px`, 1행 일 때 `16px`
  - fill: `rgba(255, 255, 255, 0.95)`, stroke: `rgba(0, 0, 0, 0.15)`
- [ ] **Verify**: 모바일 뷰로 너비를 조절했을 때, 기존의 좌우 겹침이 사라지고 모든 노드 머리 위에 말풍선 배지 형태로 라벨이 아름답고 선명하게 렌더링되는지 시각적 검증 통과.

### [Task 3] [BLOCKING] 모바일 100% 압축 화면 맞춤 및 줌 정합성 튜닝
- [ ] 모바일 가로 뷰포트(<= 768px)에서 `sankeySvg.style.width`를 `100%`로 고정하여 좌우 가로 스크롤바 생성 원천 차단.
- [ ] 모바일 렌더링 시 노드 간 수직 간격(`nodeGap`)을 `hasGroupLayer ? 14 : 10`으로 압축하여 좁은 세로 영역 최적화.
- [ ] 모바일 컬럼 간 간격 및 step 계산 식 재조정하여 압축 상황에서의 가독성 극대화.
- [ ] **Verify**: 뷰포트를 320px에서 768px 사이로 줄일 때 가로 스크롤바 없이 SVG 프레임 자체가 100% 화면 맞춤을 안정적으로 수행하며, 요소가 깨지지 않는지 반응형 검증 통과.

---

## 3. UAT (사용자 검증) 계획

### A. 자동 빌드 무결성 점검
```powershell
# Vite 빌드 파이프라인 정합성 검증
npm run build
```
- 결과 빌드에 아무런 타입 오류나 CSS 정합성 누수가 발생하지 않고 완료되어야 함.

### B. 시각 정합성 및 접근성 점검 (768px 이하 모바일 환경)
1. 브라우저 창 너비를 768px 이하로 변환.
2. 각 지출 및 저축 노드의 라벨이 겹치거나 흐릿하게 보이지 않고, 배지형 배경 위에서 선명한 대비(Contrast)를 구현하는지 확인.
3. Sunset(#ea5b2a)에서 Deep Sea(#1e8b7c)로의 그라디언트 링크 선이 미려하게 이식되었는지 크롬/엣지 브라우저에서 관측.

---

## 4. 리스크 관리 및 방어책

- **그라디언트 미지원 브라우저 대응**: 아주 구형 기기 등에서 SVG linearGradient 파싱이 실패하더라도 최소한의 렌더링 무결성을 유지할 수 있도록, CSS 클래스(`sankey-path`) 기반의 fallback 투명 컬러(stroke) 속성을 병행 지정해 둡니다.
- **물리적 무결성(CSS Truncation)**: 스타일 변경 시 `styles.css` 및 `step-theme.css` 하단의 `@media` 미디어 쿼리가 손실되지 않도록 수정 후 파일 라인 수와 구조를 면밀히 대조합니다.
