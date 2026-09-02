// Optional PFC Mirror storage adapter. Not loaded by index.html; dual read/write preserves legacy browser data if adopted later.
(() => {
  const PREFIX = 'pfc-mirror:v1:';
  const backing = window.localStorage;
  const keys = () => Array.from({length: backing.length}, (_, i) => backing.key(i)).filter(k => k && k.startsWith(PREFIX));
  const api = {
    getItem(key) { const k = String(key); const scoped = backing.getItem(PREFIX + k); return scoped !== null ? scoped : backing.getItem(k); },
    setItem(key, value) { const k = String(key), v = String(value); backing.setItem(k, v); backing.setItem(PREFIX + k, v); },
    removeItem(key) { const k = String(key); backing.removeItem(k); backing.removeItem(PREFIX + k); },
    clear() { for (const key of keys()) { backing.removeItem(key.slice(PREFIX.length)); backing.removeItem(key); } },
    key(index) { const key = keys()[index]; return key ? key.slice(PREFIX.length) : null; }
  };
  Object.defineProperty(api, 'length', { get() { return keys().length; } });
  window.mirrorStorage = api;
})();
