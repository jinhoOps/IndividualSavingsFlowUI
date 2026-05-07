
import { IsfUtils } from '../core/utils.js';

export class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.currentStep = this.getAttribute('current-step') || '1';
    this.status = 'idle';
    this.statusMessage = '자동 저장 활성';
  }

  connectedCallback() {
    this.render();
  }

  /**
   * 상태 인디케이터 업데이트 (현재는 시각적 요소가 제거되어 로직만 유지)
   */
  updateStatus(status, message) {
    this.status = status;
    if (message) this.statusMessage = message;
  }

  render() {
    const version = this.getAttribute('version') || (IsfUtils ? IsfUtils.APP_VERSION : '0.0.0');
    
    const stepLabels = {
      '1': '현금 흐름',
      '2': '배당 시뮬',
      '3': '포트폴리오',
      '4': '백테스트'
    };
    const currentLabel = stepLabels[this.currentStep] || '백테스트';

    this.innerHTML = `
      <header class="app-header">
        <div class="app-header__inner">
          <div style="display: flex; align-items: center; gap: var(--sp-sm);">
            <button type="button" id="appLauncherBtn" class="btn btn-ghost btn-sm" style="padding: 4px; min-width: 32px; min-height: 32px;" title="메뉴">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="4" cy="4" r="2"></circle>
                <circle cx="12" cy="4" r="2"></circle>
                <circle cx="20" cy="4" r="2"></circle>
                <circle cx="4" cy="12" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="20" cy="12" r="2"></circle>
                <circle cx="4" cy="20" r="2"></circle>
                <circle cx="12" cy="20" r="2"></circle>
                <circle cx="20" cy="20" r="2"></circle>
              </svg>
            </button>
            <div class="app-header__logo-group" style="display: flex; align-items: center; gap: var(--sp-xs);">
              <a href="/IndividualSavingsFlowUI/" class="app-header__logo" style="font-weight: 800; letter-spacing: -0.5px;">ISF UIUX</a>
              <span style="color: var(--line-strong); font-size: 1.2rem; font-weight: 300;">|</span>
              <span class="current-step-label" style="font-weight: 700; color: var(--tone-primary); font-size: var(--text-body-md);">${currentLabel}</span>
            </div>
          </div>

          <!-- 드롭다운 메뉴 (런처 클릭 시 노출) -->
          <div id="appLauncherMenu" class="launcher-menu shadow-float" style="display: none;">
            <div class="launcher-menu__inner">
              <a href="../step1/" class="launcher-item ${this.currentStep === '1' ? 'is-active' : ''}">
                <span class="launcher-item__icon">📊</span>
                <span class="launcher-item__text">현금 흐름</span>
              </a>
              <a href="../step2/" class="launcher-item ${this.currentStep === '2' ? 'is-active' : ''}">
                <span class="launcher-item__icon">💰</span>
                <span class="launcher-item__text">배당 시뮬</span>
              </a>
              <a href="../step4/" class="launcher-item ${this.currentStep === '4' ? 'is-active' : ''}">
                <span class="launcher-item__icon">📈</span>
                <span class="launcher-item__text">백테스트</span>
              </a>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: var(--sp-xs); position: relative;">
            <span class="version-badge">v${version}</span>
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

    // 런처 메뉴 토글 로직
    const launcherBtn = this.querySelector('#appLauncherBtn');
    const launcherMenu = this.querySelector('#appLauncherMenu');
    
    launcherBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = launcherMenu.style.display === 'block';
      launcherMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      launcherMenu.style.display = 'none';
    });

    this.querySelector('#headerDataHubBtn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('open-data-hub'));
    });
  }
}

if (!customElements.get('app-header')) {
  customElements.define('app-header', AppHeader);
}

