// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER — Quiz Bot Offline Cache
// Strategiya: Cache-first statik fayllar, Network-first JSON suallar
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_NAME    = 'quiz-bot-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/script.js',
    '/banks.json',
    'https://telegram.org/js/telegram-web-app.js',
    'https://cdn.tailwindcss.com',
];

// ─── INSTALL — statik faylları ilk dəfə cache-lə ─────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())   // yeni SW dərhal aktivləşsin
    );
});

// ─── ACTIVATE — köhnə cache versiyalarını sil ─────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())  // açıq tabları dərhal idarə et
    );
});

// ─── FETCH — sorğuları tut ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Yalnız GET sorğularına müdaxilə et
    if (request.method !== 'GET') return;

    // Chrome extension sorğularını keç
    if (url.protocol === 'chrome-extension:') return;

    // ── Sual JSON faylları: Network-first, Cache fallback ────────────────────
    // banks.json istisna — o statik, həmişə cache-dən gəlsin
    if (url.pathname.endsWith('.json') && url.pathname !== '/banks.json') {
        event.respondWith(networkFirstWithCache(request));
        return;
    }

    // ── Hər şey başqa: Cache-first, Network fallback ──────────────────────────
    event.respondWith(cacheFirstWithNetwork(request));
});

// ─── Strategiya 1: Cache-first ────────────────────────────────────────────────
// Statik fayllar üçün (HTML, JS, banks.json, Telegram SDK)
async function cacheFirstWithNetwork(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        // Uğurlu cavabları cache-ə əlavə et
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Offline olduqda xüsusi fallback
        return offlineFallback(request);
    }
}

// ─── Strategiya 2: Network-first ─────────────────────────────────────────────
// Sual JSON faylları üçün — həmişə ən yeni versiyanı al, offline-da cache-dən qaytar
async function networkFirstWithCache(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            // Uğurlu cavabı cache-ə yaz (növbəti offline üçün)
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Network yoxdur — cache-dən qaytar
        const cached = await caches.match(request);
        if (cached) return cached;
        return offlineFallback(request);
    }
}

// ─── Offline fallback ─────────────────────────────────────────────────────────
function offlineFallback(request) {
    const url = new URL(request.url);

    // JSON sorğusu üçün boş xəta cavabı
    if (url.pathname.endsWith('.json')) {
        return new Response(
            JSON.stringify({ error: 'offline', message: 'Sual faylı cache-də tapılmadı' }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    // HTML sorğusu üçün offline səhifə (cache-dən index.html)
    return caches.match('/index.html')
        .then(r => r || new Response('Offline', { status: 503 }));
}

// ─── MESSAGE — app-dan gələn komandalar ──────────────────────────────────────
// script.js-dən `navigator.serviceWorker.controller.postMessage(...)` ilə çağırılır
self.addEventListener('message', event => {
    if (event.data?.type === 'CACHE_QUIZ') {
        // Konkret sual faylını əl ilə cache-lə
        const { path } = event.data;
        caches.open(CACHE_NAME)
            .then(cache => cache.add(path))
            .catch(err => console.warn('SW: quiz cache failed:', err));
    }

    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});