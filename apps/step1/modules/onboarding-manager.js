/**
 * Onboarding Manager for Step 1
 * Handles the spotlight guide for new users to explain the preset feature.
 */

const ONBOARDING_KEY = 'isf-onboarding-step1-preset-v1';

/**
 * Initializes the onboarding flow.
 * Checks if the user has already seen the guide.
 */
export const initOnboarding = () => {
  if (typeof window === 'undefined') return;

  // Skip if already completed
  const isCompleted = localStorage.getItem(ONBOARDING_KEY) === 'true';
  if (isCompleted) return;

  // Skip in view mode (shared page) to avoid distracting viewers
  const isViewMode = new URLSearchParams(window.location.search).has('sid') || 
                     window.location.hash.includes('s=');
  if (isViewMode) return;

  // Delay slightly to ensure initial rendering and animations are done
  setTimeout(showStep1PresetGuide, 1200);
};

/**
 * Shows the spotlight guide for the preset block.
 */
export const showStep1PresetGuide = () => {
  const presetBlock = document.getElementById('presetBlock');
  if (!presetBlock) return;

  // Create overlay if it doesn't exist
  let overlay = document.getElementById('onboardingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.id = 'onboardingOverlay';
    document.body.appendChild(overlay);
  }

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';
  tooltip.id = 'onboardingTooltip';
  tooltip.innerHTML = `
    <b>반갑습니다! 👋</b>
    처음이시라면 <b>프리셋 템플릿</b>을 통해<br>
    기본 데이터를 간편하게 채워보세요.<br>
    적용 후 아래에서 자유롭게 수정 가능합니다.
  `;
  presetBlock.appendChild(tooltip);

  // Activate styles
  document.body.classList.add('is-onboarding-active');
  presetBlock.classList.add('is-onboarding-active');

  // Define cleanup function
  const closeGuide = () => {
    document.body.classList.remove('is-onboarding-active');
    presetBlock.classList.remove('is-onboarding-active');
    if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    
    // Persist completion status
    localStorage.setItem(ONBOARDING_KEY, 'true');
  };

  // Close on apply button click or overlay click
  const applyBtn = document.getElementById('applyPresetBtn');
  if (applyBtn) {
    applyBtn.addEventListener('click', closeGuide, { once: true });
  }
  
  overlay.addEventListener('click', closeGuide, { once: true });

  // Scroll to preset block if not in view
  presetBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/**
 * Resets the onboarding status (for testing or re-onboarding).
 */
export const resetOnboarding = () => {
  localStorage.removeItem(ONBOARDING_KEY);
};
