/* Keeps your data safe: asks the browser not to delete it, and keeps a second copy in IndexedDB.
   If the main copy disappears, the second one is restored automatically. Loaded before app.js. */
(function () {
  'use strict';
  const PRE = 'calc.', DB = 'calc-backup', KEY = 'all';
  window.calcPersisted = null;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { window.calcPersisted = ok; }); } catch (e) { /* ignore */ }
  function db() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  const get = () => db().then((d) => new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); })).catch(() => null);
  const put = (v) => db().then((d) => { d.transaction('kv', 'readwrite').objectStore('kv').put(v, KEY); }).catch(() => {});
  const keys = () => { try { return Object.keys(localStorage).filter((k) => k.startsWith(PRE)); } catch (e) { return []; } };
  function snapshot() { const o = {}; keys().forEach((k) => { o[k] = localStorage.getItem(k); }); return o; }
  if (!keys().length) {
    get().then((o) => {
      let tried = null; try { tried = sessionStorage.getItem('calc.restored'); } catch (e) { /* ignore */ }
      if (o && Object.keys(o).length && !tried) { try { Object.keys(o).forEach((k) => localStorage.setItem(k, o[k])); sessionStorage.setItem('calc.restored', '1'); location.reload(); } catch (e) { /* ignore */ } }
    });
  }
  window.calcForget = () => put({}).then(() => { try { sessionStorage.setItem('calc.restored', '1'); } catch (e) { /* ignore */ } });
  let last = '';
  function mirror() { try { const o = snapshot(); const j = JSON.stringify(o); if (Object.keys(o).length && j !== last) { last = j; put(o); } } catch (e) { /* ignore */ } }
  setInterval(mirror, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) mirror(); });
  window.addEventListener('pagehide', mirror);
})();
