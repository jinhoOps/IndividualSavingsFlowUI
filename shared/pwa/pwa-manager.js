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
      this.getCurrentData = config.getCurrentData || (() => null);
      this.appKey = config.appKey || "isf-hub";
      this.pwaVersionLastCheckedAt = 0;
      this.deferredPrompt = null;
    }

    init() {
      this.syncVersionCheckTriggerVisibility();
      this.bindPwaInstallEvents();
      this.bindPwaLifecycleFeedback();
      this.bindNetworkStatusFeedback();
      this.registerServiceWorker();
      this.maybeShowStandaloneLaunchFeedback();
      this.bindPwaVersionAwareness();

      if (this.versionCheckTriggerElement) {
        this.versionCheckTriggerElement.addEventListener("click", () => {
          void this.maybeCheckRemotePwaVersion({ force: true, showUpToDateFeedback: true });
        });
      }

      // 앱 실행(Cold Start) 시 즉시 버전 체크 수행
      void this.maybeCheckRemotePwaVersion();
    }

    bindPwaInstallEvents() {
      if (typeof window === "undefined") return;
      window.addEventListener("beforeinstallprompt", (event) => {
        // 브라우저의 기본 설치 알림을 막고 이벤트를 저장합니다.
        event.preventDefault();
        this.deferredPrompt = event;
        // 삼성 인터넷 등 일부 브라우저에서 설치 가능함을 디버그 로그로 남깁니다.
        console.log("PWA: Installable state detected.");
      });
    }

    async promptInstall() {
      if (!this.deferredPrompt) {
        this.onFeedback("이미 설치되어 있거나 브라우저에서 설치를 지원하지 않습니다.");
        return;
      }
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === "accepted") {
        this.deferredPrompt = null;
      }
    }

    bindPwaLifecycleFeedback() {
      if (typeof window === "undefined") return;
      window.addEventListener("appinstalled", () => {
        this.onFeedback(`웹앱 설치가 완료되었습니다. v${this.appVersion}`);
      });
    }

    // 오프라인/온라인 네트워크 상태 변화를 감지하여 토스트로 안내합니다.
    bindNetworkStatusFeedback() {
      if (typeof window === "undefined" || typeof navigator === "undefined") return;

      // 앱 초기 로딩 시 이미 오프라인인 경우 안내
      if (!navigator.onLine) {
        this.onFeedback("오프라인 모드: 네트워크 연결 없이 앱을 이용 중입니다.");
      }

      window.addEventListener("offline", () => {
        this.onFeedback("오프라인 모드: 네트워크 연결이 끊겼습니다. 저장된 데이터로 계속 이용 가능합니다.");
      });

      window.addEventListener("online", () => {
        this.onFeedback("네트워크 연결이 복구되었습니다.");
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
      
      // 설치된 상태(Standalone)라면 데스크톱/모바일 구분 없이 체크 허용
      if (!isStandaloneDisplayMode()) return false;
      
      return window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
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
        const registration = await navigator.serviceWorker.getRegistration();
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
        const manifestUrl = this.manifestPath;
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
        void this.triggerAutoBackupAndUpgrade(registration);
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

    async triggerAutoBackupAndUpgrade(registration) {
      if (!registration || !registration.waiting) return;

      this.onFeedback("새 버전 감지: 데이터를 안전하게 자동 백업하고 업데이트를 진행합니다...");

      try {
        const data = this.getCurrentData();
        if (data && global.IsfBackupManager) {
          const currentEntries = await global.IsfBackupManager.loadBackupEntriesFromDb(this.appKey);
          if (currentEntries === null) return;
          await global.IsfBackupManager.createBackupEntry(currentEntries, data, {
            type: "auto",
            source: "pwa-update",
            appKey: this.appKey,
            allowDuplicate: true
          });
        }
      } catch (error) {
        console.error("PWA 업데이트 전 백업 실패:", error);
      }

      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    registerServiceWorker() {
      if (!shouldUseServiceWorker()) return;

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      navigator.serviceWorker.register(this.swPath)
        .then((registration) => {
          this.bindServiceWorkerUpdateFeedback(registration);
        })
        .catch(() => {});
    }
  }

  global.IsfPwaManager = PwaManager;

})(window);
