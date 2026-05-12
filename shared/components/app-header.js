
import { IsfUtils } from '../core/utils.js';

export class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.currentStep = this.getAttribute('current-step') || '1';
    this.status = 'idle';
    this.statusMessage = '자동 저장 활성';
    this._onDocumentClick = this._onDocumentClick.bind(this);
  }

  connectedCallback() {
    this.render();
    document.addEventListener('click', this._onDocumentClick);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocumentClick);
  }

  _onDocumentClick(e) {
    const launcherMenu = this.querySelector('#appLauncherMenu');
    if (launcherMenu && !this.contains(e.target)) {
      launcherMenu.style.display = 'none';
    }
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
            <div class="app-header__logo-group" style="display: flex; align-items: center; gap: var(--sp-xs);">
              <a href="/IndividualSavingsFlowUI/" class="app-header__logo" style="font-weight: 800; letter-spacing: -0.5px;">ISF UIUX</a>
              <span style="color: var(--line-strong); font-size: 1.2rem; font-weight: 300;">|</span>
              <span class="current-step-label" style="font-weight: 700; color: var(--tone-primary); font-size: var(--text-body-md);">${currentLabel}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: var(--sp-xs); position: relative;">
            <span class="version-badge">v${version}</span>
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
                <a href="../step3/" class="launcher-item ${this.currentStep === '3' ? 'is-active' : ''}">
                  <span class="launcher-item__icon">💼</span>
                  <span class="launcher-item__text">포트폴리오</span>
                </a>
                <div style="margin-top: var(--sp-xs); border-top: 1px solid var(--line);"></div>
                <button type="button" id="headerDataHubBtn" class="launcher-item" style="width: 100%; border: none; background: none; text-align: left; cursor: pointer;">
                  <span class="launcher-item__icon">⚙️</span>
                  <span class="launcher-item__text">데이터 관리</span>
                </button>
              </div>
            </div>
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

    this.querySelector('#headerDataHubBtn').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('open-data-hub'));
    });
  }
}

if (!customElements.get('app-header')) {
  customElements.define('app-header', AppHeader);
}
