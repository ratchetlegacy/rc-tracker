// Ratchet Legacy Tracker — minimal service worker
// Its main job is to make the app installable as a PWA on desktop (Chrome/Edge
// require a registered service worker before firing `beforeinstallprompt`).
// We keep caching deliberately light so users always get fresh content.

const CACHE = 'rc-tracker-v1';

self.addEventListener('install', (event) => {
  // Activate immediately, don't wait for old SW to be released
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up any old caches and take control of open pages
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Never cache Supabase / Cloudinary / API calls — always go to network
  const url = req.url;
  if (
    url.includes('supabase.co') ||
    url.includes('cloudinary.com') ||
    url.includes('/auth/') ||
    url.includes('/rest/')
  ) {
    return; // let the browser handle it normally
  }

  // Network-first for everything else, fall back to cache when offline
  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache a copy of successful, same-origin responses
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
