// sw.js — Service Worker untuk Analisa Tagihan (PWA offline caching)
// Naikkan versi ini (v2, v3, dst) setiap kali index.html di-update,
// supaya pengguna otomatis dapat versi baru.
const CACHE_NAME = "analisa-tagihan-v1";

// File "app shell" yang wajib bisa dibuka walau offline.
// Path relatif ("./") supaya tetap benar di GitHub Pages (mis. /ANALISAv1/).
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

// Install: simpan app shell ke cache.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            // Jangan sampai satu file hilang (mis. icon-512 belum ada) membuat install gagal total.
            console.warn("[SW] Gagal cache saat install:", url, err);
          })
        )
      )
    )
  );
});

// Activate: hapus cache versi lama.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch:
// - Navigasi (buka/refresh halaman)   -> network-first, fallback ke index.html dari cache saat offline.
// - Asset lain (CSS/JS CDN, ikon dll) -> cache-first, lalu diperbarui diam-diam di belakang layar.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(
          () =>
            caches.match("./index.html").then((res) => res || caches.match(req))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
