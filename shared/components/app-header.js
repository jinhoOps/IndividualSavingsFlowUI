/**
 * ISF App Header Component (v0.3)
 * 모든 단계에서 공통으로 사용하는 상단 네비게이션 헤더입니다.
 */
export class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.currentStep = this.getAttribute('current-step') || '1';
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <header class="app-header">
        <div class="app-header__inner">
          <a href="/" class="app-header__logo">ISF UIUX</a>
          <nav class="app-header__nav">
            <a href="../step1/" class="nav-link ${this.currentStep === '1' ? 'is-active' : ''}" 
               onclick="if(window.location.pathname.includes('step1')) { event.preventDefault(); } else { window.location.replace('../step1/'); event.preventDefault(); }">
               Step 1. 가계 흐름
            </a>
            <a href="../step2/" class="nav-link ${this.currentStep === '2' ? 'is-active' : ''}"
               onclick="if(window.location.pathname.includes('step2')) { event.preventDefault(); } else { window.location.replace('../step2/'); event.preventDefault(); }">
               Step 2. 포트폴리오
            </a>
          </nav>
        </div>
      </header>
    `;
  }
}

if (!customElements.get('app-header')) {
  customElements.define('app-header', AppHeader);
}
