const CACHE = 'kerst-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'audio/01-wij-komen-tesamen.mp3',
  'audio/02-maria-die-zoude.mp3',
  'audio/03-wiegelied.mp3',
  'audio/04-de-herdertjes.mp3',
  'audio/05-gloria.mp3',
  'audio/06-er-is-een-kindeke.mp3',
  'audio/07-daar-boven-aan-de-hemel.mp3',
  'audio/08-midden-in-de-winternacht.mp3',
  'audio/09-stille-nacht.mp3',
  'audio/10-klokken.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(cs => cs.forEach(c => c.postMessage('cached')))
  );
});

// iPhone vraagt audio op in stukjes (Range-verzoeken); die beantwoorden we vanuit de cache.
async function rangeResponse(req, cached) {
  const range = req.headers.get('range');
  const buf = await cached.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
  if (m && !m[1] && m[2]) { start = size - parseInt(m[2], 10); end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.mp3')) {
    e.respondWith((async () => {
      const cached = await caches.match(url.pathname.split('/').slice(-2).join('/'), { ignoreSearch: true })
                  || await caches.match(req.url, { ignoreSearch: true });
      if (!cached) return fetch(req);
      return req.headers.get('range') ? rangeResponse(req, cached) : cached;
    })());
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
