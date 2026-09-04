// PFC Mirror V41 active runtime bootstrap.
// Important: this file is the only active loader path. It never falls back to V35.
(() => {
  'use strict';

  const BUILD = 'V41 VOICE';
  const BUILD_ID = '20260904-v41-rebuild1';
  const MIRROR_SCOPE = '/pfc-mirror/';
  const CURRENT_SCRIPTS = [
    'ai-v2.js?v=20260904-ai2-fm1',
    'edit-fix.js?v=20260904-editfix2-fm1',
    'senior-v4.js?v=20260904-senior-v4',
    'voice-modes-v5.js?v=20260904-voice-modes-v5',
    'voice-modes-v6.js?v=20260904-voice-modes-v6'
  ];

  window.__PFC_ACTIVE_RUNTIME__ = {
    build: BUILD,
    buildId: BUILD_ID,
    architecture: 'single-active-runtime',
    legacyFallback: false,
    serviceWorker: false,
    startedAt: new Date().toISOString()
  };

  function paintVersion(label = BUILD) {
    const nodes = document.querySelectorAll('.app-build-version');
    nodes.forEach(node => { node.textContent = label; node.setAttribute('data-active-build', BUILD_ID); });
  }

  function showFatal(message) {
    paintVersion(BUILD + ' ERROR');
    let box = document.getElementById('pfc-v41-fatal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pfc-v41-fatal';
      box.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;top:72px;max-width:680px;margin:auto;padding:16px 18px;border-radius:16px;background:#fff3f2;border:2px solid #cf3d35;color:#7c211c;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;font-weight:800;box-shadow:0 12px 35px rgba(0,0,0,.18)';
      document.body.appendChild(box);
    }
    box.textContent = '最新版の起動に失敗しました。旧版には戻しません。再読み込みしてください。' + (message ? ' (' + message + ')' : '');
  }

  async function retireOldWorkersAndCaches() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.filter(reg => {
          try { return new URL(reg.scope).pathname.startsWith(MIRROR_SCOPE); }
          catch (_) { return false; }
        }).map(reg => reg.unregister().catch(() => false)));
      }
    } catch (_) {}
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => /(pfc-mirror|tamafit-pfc-mirror|pfc-v3|pfc-v35)/i.test(k)).map(k => caches.delete(k)));
    } catch (_) {}
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.pfcV41 = '1';
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error('script load failed: ' + src));
      document.body.appendChild(s);
    });
  }

  async function waitForRecovery(timeoutMs = 7000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (window.__PFC_V6_RECOVERY__) return window.__PFC_V6_RECOVERY__;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Food Master recovery timeout');
  }

  window.forceAppUpdate = async function forceAppUpdateV41() {
    await retireOldWorkersAndCaches();
    const u = new URL(location.origin + MIRROR_SCOPE);
    u.searchParams.set('build', BUILD_ID);
    u.searchParams.set('t', Date.now());
    location.replace(u.href);
  };

  // Paint immediately so the old shell label is never treated as the active version.
  paintVersion(BUILD + ' BOOT');
  const observer = new MutationObserver(() => paintVersion(BUILD));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  (async () => {
    try {
      await retireOldWorkersAndCaches();

      // Load the recovered Food Master/V6 engine from an archival implementation file.
      // This is a dependency, not a rollback target.
      await loadScript('pfc-v6-loader-recovered.js?v=20260904-v41');
      await waitForRecovery();

      for (const src of CURRENT_SCRIPTS) await loadScript(src);

      paintVersion(BUILD);
      window.__PFC_ACTIVE_RUNTIME__.ready = true;
      window.__PFC_ACTIVE_RUNTIME__.readyAt = new Date().toISOString();
      document.documentElement.setAttribute('data-pfc-active-build', BUILD_ID);
    } catch (err) {
      console.error('[PFC V41 bootstrap] fatal', err);
      window.__PFC_ACTIVE_RUNTIME__.ready = false;
      window.__PFC_ACTIVE_RUNTIME__.error = String(err && err.message || err);
      showFatal(window.__PFC_ACTIVE_RUNTIME__.error);
    }
  })();
})();
