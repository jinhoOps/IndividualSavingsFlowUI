const APP_VERSION = "0.11.80";

const CACHE_NAME = `isf-static-v${APP_VERSION}`;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./apps/main/index.html",
  "./apps/main/app.js",
  "./apps/main/styles.css",
  "./apps/main/modules/onboarding-manager.js",
  "./apps/main/modules/snapshot-manager.js",
  "./apps/main/modules/calculator.js",
  "./apps/main/modules/constants.js",
  "./apps/main/modules/dom.js",
  "./apps/main/modules/formatters.js",
  "./apps/main/modules/input-sanitizer.js",
  "./apps/main/modules/sankey-builder.js",
  "./apps/main/modules/sankey-renderer.js",
  "./apps/main/modules/state-helpers.js",
  "./apps/main/modules/state.js",
  "./apps/main/modules/storage-manager.js",
  "./apps/simulation/index.html",
  "./apps/simulation/styles.css",
  "./apps/simulation/app.js",
  "./apps/simulation/modules/step1-connector.js",

  "./apps/simulation/modules/calculator.js",
  "./apps/simulation/modules/constants.js",
  "./apps/simulation/modules/dom.js",
  "./apps/simulation/modules/renderers.js",
  "./apps/simulation/modules/state.js",
  "./apps/simulation/modules/storage-handler.js",
  "./shared/styles/step-theme.css",
  "./shared/core/utils.js",
  "./shared/core/share-utils.js",
  "./shared/storage/hub-storage.js",
  "./shared/storage/backup-manager.js",
  "./shared/components/app-header.js",
  "./shared/components/data-hub-modal.js",
  "./shared/components/feedback-manager.js",
  "./shared/pwa/pwa-manager.js",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put("./index.html", response.clone());
    return response;
  } catch (_error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    const fallback = await caches.match("./index.html");
    if (fallback) {
      return fallback;
    }
    return new Response("offline", {
      status: 503,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
  }
}

async function handleAssetRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (_error) {
    return new Response("", { status: 504 });
  }
}
