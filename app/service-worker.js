/* Fit App service worker. Shape from Meal Prep v11 (the QA fix):
   activate purges every non-current cache, fetch is scoped to the
   current cache, so returning users never run old code forever. */
"use strict";
var CACHE = "fitapp-v29";
var FILES = ["./", "index.html", "styles.css", "data.js", "logic.js", "app.js",
  "meals-data.js", "meals-nutrition.js", "meals-logic.js", "exercises-data.js", "anim-data.js", "anim.js", "wally.js", "accounts-config.js", "auth.js", "demo-seed.js",
  "icon.svg", "icons/icon-192.png", "icons/icon-512.png", "manifest.webmanifest", "privacy.html",
  "fonts/ZillaSlab-600.woff2", "fonts/ZillaSlab-700.woff2", "fonts/Karla-400.woff2", "fonts/Karla-700.woff2", "fonts/Karla-400-italic.woff2",
  "assets/wally-welcome.webp", "assets/wally-rest.webp", "assets/wally-rough.webp"];
/* The photo model (vendor/, 20 MB) is not precached: it loads on
   first use of a photo tool and the fetch handler caches it then. */
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  /* The owner route is a separate surface: the app shell
     never caches it, serves it, or holds it offline. */
  var path = new URL(e.request.url).pathname;
  if (path.endsWith("/owner.html") || path.endsWith("/owner.js")) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) c.put(e.request, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
