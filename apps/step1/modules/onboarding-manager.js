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

    // Create overlay
    const overlay = this.getOrCreateOverlay();
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';
    tooltip.id = 'onboardingTooltip';
    tooltip.innerHTML = step.content;
    target.appendChild(tooltip);

    // Activate styles
    document.body.classList.add('is-onboarding-active');
    target.classList.add('is-onboarding-active');

    const cleanup = () => {
      document.body.classList.remove('is-onboarding-active');
      target.classList.remove('is-onboarding-active');
      if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      
      this.finish();
    };

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
 */
export const initOnboarding = () => {
  const manager = new IsfOnboardingManager({
    key: 'isf-onboarding-step1-preset-v1',
    isViewMode: () => {
       return new URLSearchParams(window.location.search).has('sid') || 
              window.location.hash.includes('s=');
    },
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
};
