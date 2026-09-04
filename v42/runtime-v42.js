// PFC Mirror V42 isolated runtime.
// This filename and every /v42/ asset path are intentionally new so legacy
// service workers using caches.match(..., {ignoreSearch:true}) cannot serve V35 assets.
(() => {
  'use strict';

  const BUILD = 'V42 VOICE';
  const BUILD_ID = '20260904-v42-isolated1';
  const V42_BASE = '/pfc-mirror/v42/';
  const MIRROR_SCOPE = '/pfc-mirror/';
  const CLEAN_RELOAD_KEY = 'pfc_v42_clean_reload_done';
  const CURRENT_SCRIPTS = [
    'ai-v2.js',
    'edit-fix.js',
    'senior-v4.js',
    'voice-modes-v5.js',
    'voice-modes-v6.js'
  ];

  window.__PFC_ACTIVE_RUNTIME__ = {
    build: BUILD,
    buildId: BUILD_ID,
    architecture: 'isolated-versioned-path',
    legacyFallback: false,
    serviceWorker: false,
    assetBase: V42_BASE,
    startedAt: new Date().toISOString()
  };

  function paintVersion(label = BUILD) {
    document.querySelectorAll('.app-build-version').forEach(node => {
      node.textContent = label;
      node.setAttribute('data-active-build', BUILD_ID);
    });
  }

  function showFatal(message) {
    paintVersion(BUILD + ' ERROR');
    let box = document.getElementById('pfc-v42-fatal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pfc-v42-fatal';
      box.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;top:72px;max-width:680px;margin:auto;padding:16px 18px;border-radius:16px;background:#fff3f2;border:2px solid #cf3d35;color:#7c211c;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;font-weight:800;box-shadow:0 12px 35px rgba(0,0,0,.18)';
      document.body.appendChild(box);
    }
    box.textContent = 'V42の起動に失敗しました。V35へは戻しません。' + (message ? ' ' + message : '');
  }

  async function retireLegacyWorkerAndCaches() {
    let hadController = false;
    try { hadController = !!navigator.serviceWorker?.controller; } catch (_) {}

    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          let isMirror = false;
          try { isMirror = new URL(reg.scope).pathname.startsWith(MIRROR_SCOPE); } catch (_) {}
          if (isMirror) {
            try { await reg.unregister(); } catch (_) {}
          }
        }
      }
    } catch (_) {}

    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (/(pfc-mirror|tamafit-pfc-mirror|pfc-v3|pfc-v35|voice-modes)/i.test(key)) {
          try { await caches.delete(key); } catch (_) {}
        }
      }
    } catch (_) {}

    return hadController;
  }

  function loadScript(name) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = V42_BASE + name;
      s.async = false;
      s.dataset.pfcV42 = '1';
      s.onload = () => resolve(name);
      s.onerror = () => reject(new Error('読み込み失敗: ' + name));
      document.body.appendChild(s);
    });
  }

  async function waitForRecovery(timeoutMs = 8000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (window.__PFC_V6_RECOVERY__) return window.__PFC_V6_RECOVERY__;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Food Masterの起動待ちがタイムアウトしました');
  }

  function reloadV42() {
    const u = new URL(location.origin + V42_BASE);
    u.searchParams.set('build', BUILD_ID);
    u.searchParams.set('t', Date.now());
    location.replace(u.href);
  }

  window.forceAppUpdate = async function forceAppUpdateV42() {
    try { sessionStorage.removeItem(CLEAN_RELOAD_KEY); } catch (_) {}
    await retireLegacyWorkerAndCaches();
    reloadV42();
  };

  paintVersion(BUILD);
  const observer = new MutationObserver(() => paintVersion(BUILD));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  (async () => {
    try {
      const hadController = await retireLegacyWorkerAndCaches();

      let alreadyClean = false;
      try { alreadyClean = sessionStorage.getItem(CLEAN_RELOAD_KEY) === BUILD_ID; } catch (_) {}
      if (hadController && !alreadyClean) {
        try { sessionStorage.setItem(CLEAN_RELOAD_KEY, BUILD_ID); } catch (_) {}
        reloadV42();
        return;
      }

      await loadScript('pfc-v6-loader-recovered.js');
      await waitForRecovery();

      for (const name of CURRENT_SCRIPTS) await loadScript(name);

      paintVersion(BUILD);
      window.__PFC_ACTIVE_RUNTIME__.ready = true;
      window.__PFC_ACTIVE_RUNTIME__.readyAt = new Date().toISOString();
      document.documentElement.setAttribute('data-pfc-active-build', BUILD_ID);
    } catch (err) {
      console.error('[PFC V42] fatal', err);
      window.__PFC_ACTIVE_RUNTIME__.ready = false;
      window.__PFC_ACTIVE_RUNTIME__.error = String(err?.message || err);
      showFatal(window.__PFC_ACTIVE_RUNTIME__.error);
    }
  })();
})();
