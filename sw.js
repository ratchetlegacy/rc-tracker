// Ratchet Legacy Tracker — minimal service worker
// Its main job is to make the app installable as a PWA on desktop (Chrome/Edge
// require a registered service worker before firing `beforeinstallprompt`).
// We keep caching deliberately light so users always get fresh content.

// v2 : le nom change volontairement. Le gestionnaire 'activate' efface
// tout cache dont le nom differe de CACHE, donc ce simple renommage
// purge l'ancien cache chez tous les visiteurs des leur prochaine visite.
const CACHE = 'rc-tracker-v10';

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

  // On ne touche a RIEN qui vienne d'un autre domaine. Avant, les
  // scripts des CDN (supabase-js, jsPDF) passaient par ici : au moindre
  // hoquet reseau, la reponse de secours valait undefined, le script
  // n'arrivait jamais et l'application restait sur une page noire.
  // Le navigateur gere ces requetes bien mieux que nous.
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // Jamais de cache sur les appels d'API, meme en same-origin.
  if (
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/rest/')
  ) {
    return; // let the browser handle it normally
  }

  // Network-first, avec repli sur le cache seulement s'il contient
  // vraiment quelque chose.
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
      .catch(async () => {
        // caches.match renvoie undefined quand la ressource n'a jamais
        // ete mise en cache. Repondre undefined fait echouer la
        // navigation et affiche une page blanche sans le moindre
        // message : c'est precisement le defaut qu'on corrige ici.
        const cached = await caches.match(req);
        if (cached) return cached;

        // Pour une navigation, on sert la page d'accueil si on l'a :
        // l'application sait se debrouiller a partir de la.
        if (req.mode === 'navigate') {
          const accueil = await caches.match('./');
          if (accueil) return accueil;
        }

        // Sinon on renvoie une vraie erreur, que la page peut voir et
        // signaler, plutot qu'un silence.
        return new Response('Offline and not in cache', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
