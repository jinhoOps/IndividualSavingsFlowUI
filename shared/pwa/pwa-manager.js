(function initIsfPwaManager(global) {
  "use strict";

  const PWA_STANDALONE_NOTICE_KEY = "isf-pwa-standalone-notice-v1";
  const PWA_REMOTE_VERSION_NOTICE_KEY = "isf-pwa-remote-version-notice-v1";
  const PWA_REMOTE_VERSION_LAST_CHECK_KEY = "isf-pwa-remote-version-last-check-v1";
  const PWA_REMOTE_VERSION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

  function shouldUseServiceWorker() {
    if (typeof window === "undefined") {
      return false;
    }
    if (!("serviceWorker" in navigator)) {
      return false;
    }
    if (window.location.protocol === "file:") {
      return false;
    }
    if (window.location.protocol === "https:") {
      return true;
    }
    const host = String(window.location.hostname || "").trim();
    return host === "localhost" || host === "127.0.0.1";
  }

  function isStandaloneDisplayMode() {
    if (typeof window === "undefined") {
      return false;
    }
    if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
    return Boolean(window.navigator.standalone);
  }

  function parseSemver(version) {
    const safe = String(version ?? "").trim();
    if (!safe) return null;
    const parts = safe.split(".").map((token) => Number.parseInt(token, 10));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
      return null;
    }
    return parts;
  }

  function compareSemver(left, right) {
    const a = parseSemver(left);
    const b = parseSemver(right);
    if (!a || !b) return 0;
    for (let index = 0; index < 3; index += 1) {
      if (a[index] > b[index]) return 1;
      if (a[index] < b[index]) return -1;
    }
    return 0;
  }

  class PwaManager {
    constructor(config) {
      this.appVersion = config.appVersion || "0.0.0";
      this.onFeedback = config.onFeedback || (() => {});
      this.isViewMode = config.isViewMode || (() => false);
      this.swPath = config.swPath || "/sw.js";
      this.manifestPath = config.manifestPath || "/manifest.webmanifest";
      this.versionCheckTriggerElement = config.versionCheckTriggerElement || null;
      this.pwaVersionLastCheckedAt = 0;
    }

    init() {
      this.syncVersionCheckTriggerVisibility();
      this.bindPwaLifecycleFeedback();
      this.registerServiceWorker();
      this.maybeShowStandaloneLaunchFeedback();
      this.bindPwaVersionAwareness();

      if (this.versionCheckTriggerElement) {
        this.versionCheckTriggerElement.addEventListener("click", () => {
          void this.maybeCheckRemotePwaVersion({ force: true, showUpToDateFeedback: true });
        });
      }
    }

    bindPwaLifecycleFeedback() {
      if (typeof window === "undefined") return;
      window.addEventListener("appinstalled", () => {
        this.onFeedback(`웹앱 설치가 완료되었습니다. v${this.appVersion}`);
      });
    }

    syncVersionCheckTriggerVisibility() {
      if (this.versionCheckTriggerElement) {
        this.versionCheckTriggerElement.hidden = !this.shouldCheckRemotePwaVersion();
      }
    }

    shouldCheckRemotePwaVersion() {
      if (typeof window === "undefined" || typeof document === "undefined") return false;
      if (this.isViewMode()) return false;
      
      const mobileLayoutMediaQuery = window.matchMedia("(max-width: 760px)");
      if (!isStandaloneDisplayMode() || !mobileLayoutMediaQuery.matches) return false;
      return window.location.protocol === "https:";
    }

    getRemotePwaVersionLastCheckedAt() {
      try {
        const raw = localStorage.getItem(PWA_REMOTE_VERSION_LAST_CHECK_KEY);
        const parsed = Number.parseInt(String(raw ?? ""), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch (_error) {
        return 0;
      }
    }

    setRemotePwaVersionLastCheckedAt(value) {
      const safeValue = Number.parseInt(String(value ?? 0), 10);
      if (!Number.isFinite(safeValue) || safeValue <= 0) return;
      try {
        localStorage.setItem(PWA_REMOTE_VERSION_LAST_CHECK_KEY, String(safeValue));
      } catch (_error) {}
    }

    async maybeTriggerServiceWorkerUpdateCheck() {
      if (!shouldUseServiceWorker()) return;
      try {
        // Find existing registration (from root)
        const registration = await navigator.serviceWorker.getRegistration(this.swPath);
        if (registration) {
          await registration.update();
        }
      } catch (_error) {}
    }

    async maybeCheckRemotePwaVersion(options = {}) {
      const safeOptions = options && typeof options === "object" ? options : {};
      const force = safeOptions.force === true;
      const showUpToDateFeedback = safeOptions.showUpToDateFeedback === true;

      if (!this.shouldCheckRemotePwaVersion()) {
        if (showUpToDateFeedback) {
          this.onFeedback("현재 환경에서는 버전 확인을 지원하지 않습니다.");
        }
        return;
      }

      const now = Date.now();
      const lastCheckedAt = Math.max(this.pwaVersionLastCheckedAt, this.getRemotePwaVersionLastCheckedAt());

      if (!force && now - lastCheckedAt < PWA_REMOTE_VERSION_CHECK_INTERVAL_MS) {
        return;
      }

      this.pwaVersionLastCheckedAt = now;
      this.setRemotePwaVersionLastCheckedAt(now);

      try {
        await this.maybeTriggerServiceWorkerUpdateCheck();
        const manifestUrl = this.manifestPath.startsWith("/") ? this.manifestPath : `/${this.manifestPath}`;
        const response = await fetch(`${manifestUrl}?vchk=${now}`, {
          cache: "no-store",
        });

        if (!response.ok) return;

        const manifest = await response.json();
        const remoteVersion = String(manifest?.version || "").trim();

        if (!remoteVersion || compareSemver(remoteVersion, this.appVersion) <= 0) {
          if (showUpToDateFeedback) {
            this.onFeedback(`최신 버전입니다. v${this.appVersion}`);
          }
          return;
        }

        try {
          const noticedVersion = localStorage.getItem(PWA_REMOTE_VERSION_NOTICE_KEY);
          if (noticedVersion === remoteVersion) return;
          localStorage.setItem(PWA_REMOTE_VERSION_NOTICE_KEY, remoteVersion);
        } catch (_error) {}

        this.onFeedback(`새 버전 v${remoteVersion} 감지 · 앱을 다시 열면 반영됩니다.`);
      } catch (_error) {
        if (showUpToDateFeedback) {
          this.onFeedback("버전 확인에 실패했습니다. 잠시 후 다시 시도하세요.");
        }
      }
    }

    bindPwaVersionAwareness() {
      this.syncVersionCheckTriggerVisibility();
      if (!shouldUseServiceWorker() || typeof document === "undefined") return;

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        void this.maybeCheckRemotePwaVersion();
      });

      window.setInterval(() => {
        void this.maybeCheckRemotePwaVersion();
      }, PWA_REMOTE_VERSION_CHECK_INTERVAL_MS);
    }

    maybeShowStandaloneLaunchFeedback() {
      if (this.isViewMode() || !isStandaloneDisplayMode()) return;
      try {
        const notifiedVersion = localStorage.getItem(PWA_STANDALONE_NOTICE_KEY);
        if (notifiedVersion === this.appVersion) return;
        localStorage.setItem(PWA_STANDALONE_NOTICE_KEY, this.appVersion);
      } catch (_error) {}
      this.onFeedback(`앱 모드로 실행 중입니다. v${this.appVersion}`);
    }

    bindServiceWorkerUpdateFeedback(registration) {
      if (!registration || typeof registration !== "object") return;
      const notifyUpdateReady = () => {
        this.onFeedback(`업데이트가 준비되었습니다. 새로고침하면 v${this.appVersion}이 적용됩니다.`);
      };

      if (registration.waiting) notifyUpdateReady();

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;
        installingWorker.addEventListener("statechange", () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            notifyUpdateReady();
          }
        });
      });
    }

    registerServiceWorker() {
      if (!shouldUseServiceWorker()) return;
      navigator.serviceWorker.register(this.swPath)
        .then((registration) => {
          this.bindServiceWorkerUpdateFeedback(registration);
        })
        .catch(() => {});
    }
  }

  global.IsfPwaManager = PwaManager;

})(window);
