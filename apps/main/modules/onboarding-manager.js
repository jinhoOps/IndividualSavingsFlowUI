/**
 * Onboarding Manager for ISF Apps
 * Handles the spotlight guide for new users to explain key features.
 */

export class IsfOnboardingManager {
  constructor(config = {}) {
    this.key = config.key || 'isf-onboarding-v1';
    this.steps = config.steps || [];
    this.delay = config.delay || 1200;
    this.isViewMode = config.isViewMode || (() => false);
    this.onComplete = config.onComplete || (() => {});
  }

  /**
   * Initializes the onboarding flow.
   */
  init() {
    if (typeof window === 'undefined') return;

    // Skip if already completed or in view mode
    if (this.isCompleted() || this.isViewMode()) return;

    // Delay slightly to ensure initial rendering is done
    setTimeout(() => this.start(), this.delay);
  }

  isCompleted() {
    try {
      return localStorage.getItem(this.key) === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Starts the onboarding sequence.
   */
  start() {
    if (this.steps.length === 0) return;
    this.showStep(0);
  }

  /**
   * Shows a specific step.
   */
  showStep(index) {
    const step = this.steps[index];
    if (!step) return;

    const target = document.getElementById(step.targetId);
    if (!target) return;

    // Check if onboarding is already active to prevent duplicates
    if (document.getElementById('onboardingTooltip') || document.body.classList.contains('is-onboarding-active')) {
      return;
    }

    // Create overlay
    const overlay = this.getOrCreateOverlay();
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.id = 'onboardingTooltip';
    tooltip.innerHTML = `
      <button type="button" class="onboarding-tooltip__close" aria-label="닫기">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="onboarding-tooltip__content">${step.content}</div>
    `;
    
    // Append to body instead of target to avoid z-index/transform issues with parents
    document.body.appendChild(tooltip);

    // Position tooltip relative to target
    this.positionTooltip(target, tooltip);

    // Activate styles
    document.body.classList.add('is-onboarding-active');
    target.classList.add('is-onboarding-active');

    const cleanup = () => {
      document.body.classList.remove('is-onboarding-active');
      target.classList.remove('is-onboarding-active');
      const currentTooltip = document.getElementById('onboardingTooltip');
      if (currentTooltip && currentTooltip.parentNode) currentTooltip.parentNode.removeChild(currentTooltip);
      const currentOverlay = document.getElementById('onboardingOverlay');
      if (currentOverlay && currentOverlay.parentNode) currentOverlay.parentNode.removeChild(currentOverlay);
      
      this.finish();
      window.removeEventListener('resize', resizeHandler);
    };

    const resizeHandler = () => this.positionTooltip(target, tooltip);
    window.addEventListener('resize', resizeHandler);

    const closeBtn = tooltip.querySelector('.onboarding-tooltip__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup();
      });
    }

    // Bind triggers to advance or close
    if (step.triggerId) {
      const trigger = document.getElementById(step.triggerId);
      if (trigger) {
        trigger.addEventListener('click', cleanup, { once: true });
      }
    }
    
    overlay.addEventListener('click', cleanup, { once: true });

    // Scroll to target
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  positionTooltip(target, tooltip) {
    if (!target || !tooltip) return;
    const rect = target.getBoundingClientRect();
    const isMobile = window.innerWidth <= 760;
    
    if (isMobile) {
      // In mobile, stick to bottom
      tooltip.style.position = 'fixed';
      tooltip.style.bottom = '20px';
      tooltip.style.left = '50%';
      tooltip.style.top = 'auto';
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.width = 'calc(100% - 40px)';
      tooltip.classList.add('is-mobile');
    } else {
      tooltip.style.position = 'absolute';
      tooltip.style.top = `${window.scrollY + rect.bottom + 14}px`;
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
      tooltip.style.transform = 'translateX(-50%)';
      tooltip.style.width = 'min(300px, 85vw)';
      tooltip.classList.remove('is-mobile');
    }
  }

  getOrCreateOverlay() {
    let overlay = document.getElementById('onboardingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'onboarding-overlay';
      overlay.id = 'onboardingOverlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  finish() {
    try {
      localStorage.setItem(this.key, 'true');
    } catch (e) {}
    this.onComplete();
  }

  reset() {
    try {
      localStorage.removeItem(this.key);
    } catch (e) {}
  }
}

/**
 * Legacy wrapper for Step 1
 * @param {boolean} isViewMode
 */
export const initOnboarding = (isViewMode = false) => {
  const manager = new IsfOnboardingManager({
    key: 'isf-onboarding-step1-preset-v1',
    isViewMode: () => isViewMode,
    steps: [
      {
        targetId: 'presetBlock',
        triggerId: 'applyPresetBtn',
        content: `
          <b>반갑습니다! 👋</b>
          처음이시라면 <b>프리셋 템플릿</b>을 통해<br>
          기본 데이터를 간편하게 채워보세요.<br>
          적용 후 아래에서 자유롭게 수정 가능합니다.
        `
      }
    ]
  });
  manager.init();
  return manager;
};
