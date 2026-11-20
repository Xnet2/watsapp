// Service worker: שומר את קבצי האתר כדי שייפתח מהר (וגם בלי רשת), ומטפל בלחיצה על התראה.
// קבצי האתר נטענים קודם מהרשת (כדי שעדכון באתר יגיע מייד) ורק אם אין רשת - מהשמירה.
// קריאות לימות המשיח, ל-Groq ולשאר שירותים חיצוניים לא עוברות דרכו בכלל.
const CACHE = 'watsapp-v1';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/core.js',
  'js/settings.js',
  'js/home.js',
  'js/contacts.js',
  'js/recordings.js',
  'js/recorder.js',
  'js/main.js',
  'manifest.webmanifest',
  'icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  // קישור הזמנה (?j=...) - לא שומרים אותו בשום מקום
  if(url.search.includes('j=')) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if(res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for(const c of list){
        if('focus' in c) return c.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});
