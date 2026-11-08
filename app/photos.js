"use strict";
/* Fit Hard private photo vault (Phase 5). Progress photos and "My gym machines" photos live ONLY on this
   device, in IndexedDB, in a database named for the signed-in account. They are never uploaded, never
   synced, never included in exports or analytics. Re-encoding through a canvas strips EXIF (location etc.).
   If IndexedDB is unavailable the vault says so; nothing pretends to be saved. */
(function (root) {
  var scope = "guest", dbp = null;
  function dbName() { return "fit-photos-" + scope; }
  function setScope(s) { var n = String(s || "guest"); if (n !== scope) { scope = n; dbp = null; } }
  function available() { return typeof indexedDB !== "undefined" && !!indexedDB; }
  function open() {
    if (!available()) return Promise.reject(new Error("unavailable"));
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var rq = indexedDB.open(dbName(), 1);
      rq.onupgradeneeded = function () { var db = rq.result; if (!db.objectStoreNames.contains("photos")) { var st = db.createObjectStore("photos", { keyPath: "id" }); st.createIndex("col", "col", { unique: false }); } };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { dbp = null; rej(rq.error || new Error("open failed")); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) { return new Promise(function (res, rej) {
      var t = db.transaction("photos", mode), st = t.objectStore("photos"), out = fn(st);
      t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error("aborted")); };
    }); });
  }
  function uid() { return "ph." + Date.now().toString(36) + "." + Math.random().toString(36).slice(2, 8); }
  function add(col, blob, meta) {
    if (!blob || !/^image\//.test(blob.type || "")) return Promise.reject(new Error("not an image"));
    var rec = { id: uid(), col: col, date: (meta && meta.date) || "", label: (meta && meta.label) || "", machineId: (meta && meta.machineId) || "", blob: blob, at: Date.now() };
    return tx("readwrite", function (st) { st.put(rec); }).then(function () { return rec.id; });
  }
  function list(col) {
    return open().then(function (db) { return new Promise(function (res, rej) {
      var out = [], rq = db.transaction("photos", "readonly").objectStore("photos").index("col").openCursor(IDBKeyRange.only(col));
      rq.onsuccess = function () { var c = rq.result; if (c) { out.push(c.value); c.continue(); } else res(out.sort(function (a, b) { return b.at - a.at; })); };
      rq.onerror = function () { rej(rq.error); };
    }); });
  }
  function remove(id) { return tx("readwrite", function (st) { st.delete(id); }); }
  function clearCol(col) { return list(col).then(function (xs) { return tx("readwrite", function (st) { xs.forEach(function (x) { st.delete(x.id); }); }); }); }
  function clearAll() { return tx("readwrite", function (st) { st.clear(); }); }
  function count() { return open().then(function (db) { return new Promise(function (res) { var rq = db.transaction("photos", "readonly").objectStore("photos").count(); rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { res(0); }; }); }); }
  /* Resize to maxPx on the long edge and re-encode as JPEG (drops EXIF). */
  function prepare(file, maxPx) {
    maxPx = maxPx || 900;
    if (!file || !/^image\//.test(file.type || "")) return Promise.reject(new Error("not an image"));
    if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error("too large"));
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxPx / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error("encode failed")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("unreadable image")); };
      img.src = url;
    });
  }
  root.FitPhotos = { setScope: setScope, available: available, add: add, list: list, remove: remove, clearCol: clearCol, clearAll: clearAll, count: count, prepare: prepare, dbName: dbName };
})(typeof window !== "undefined" ? window : globalThis);
