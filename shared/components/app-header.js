/**
 * ISF App Header Component (v0.4)
 * 모든 단계에서 공통으로 사용하는 상단 네비게이션 헤더입니다.
 * 저장 상태 인디케이터와 데이터 관리 버튼 기능이 포함되어 있습니다.
 */
export class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.currentStep = this.getAttribute('current-step') || '1';
    this.status = 'idle'; // idle, saving, success, error
    this.statusMessage = '자동 저장 활성';
  }

  connectedCallback() {
    this.render();
  }

  /**
   * 헤더의 저장 상태를 업데이트합니다.
   * @param {string} status 'saving', 'success', 'error', 'idle'
   * @param {string} message 표시할 메시지
   */
  updateStatus(status, message) {
    this.status = status;
    if (message) this.statusMessage = message;
    
    const indicator = this.querySelector('#statusIndicator');
    if (indicator) {
      indicator.className = `status-indicator status-indicator--${status}`;
      const text = indicator.querySelector('.status-indicator__text');
      if (text) text.textContent = this.statusMessage;
    }
  }

  render() {
    this.innerHTML = `
      <header class="app-header">
        <div class="app-header__inner">
          <div style="display: flex; align-items: center; gap: var(--sp-md);">
            <a href="/IndividualSavingsFlowUI/" class="app-header__logo">ISF UIUX</a>
            
            <div id="statusIndicator" class="status-indicator status-indicator--${this.status}">
              <span class="status-indicator__dot"></span>
              <span class="status-indicator__text" style="display: none;">${this.statusMessage}</span>
            </div>
          </div>

          <nav class="app-header__nav">
            <a href="../step1/" class="nav-link ${this.currentStep === '1' ? 'is-active' : ''}" 
               onclick="if(window.location.pathname.includes('step1')) { event.preventDefault(); } else { window.location.assign('../step1/'); event.preventDefault(); }">
               현금 흐름
            </a>
            <a href="../step2/" class="nav-link ${this.currentStep === '2' ? 'is-active' : ''}"
               onclick="if(window.location.pathname.includes('step2')) { event.preventDefault(); } else { window.location.assign('../step2/'); event.preventDefault(); }">
               포트폴리오
            </a>
          </nav>

          <div style="display: flex; align-items: center; gap: var(--sp-xs);">
            <button type="button" id="headerDataHubBtn" class="btn btn-ghost btn-sm" title="데이터 관리">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        </div>
      </header>
    `;

    // 텍스트는 데스크톱에서만 보이도록 인라인 스타일로 처리하거나 CSS에서 제어
    // 미디어 쿼리를 사용하기 위해 스타일을 추가로 적용할 수 있습니다.
    const indicatorText = this.querySelector('.status-indicator__text');
    if (indicatorText && window.innerWidth > 760) {
      indicatorText.style.display = 'inline';
    }

    this.querySelector('#headerDataHubBtn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('open-data-hub'));
    });
  }
}

if (!customElements.get('app-header')) {
  customElements.define('app-header', AppHeader);
}
