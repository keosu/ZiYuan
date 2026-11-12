// 字源离线缓存
// 页面与脚本走网络优先，离线时用缓存；字体、图标、笔顺数据不会变，走缓存优先。
const VERSION = "ziyuan-v1";
const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/data.js",
  "js/extra.js",
  "js/app.js",
  "assets/fonts/Chine-Culture-Jiaguwen.woff2",
  "assets/fonts/Chine-Culture-Jinwen.woff2",
  "assets/fonts/Chine-Culture-Xiaozhuan.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/favicon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function put(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
}

function networkFirst(req) {
  return fetch(req).then((res) => put(req, res)).catch(() =>
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")));
}

function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res)));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const stable = /\/assets\/(fonts|icons|strokes)\//.test(url.pathname);
    e.respondWith(stable ? cacheFirst(req) : networkFirst(req));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req));
  }
});
