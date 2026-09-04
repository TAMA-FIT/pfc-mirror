// PFC Mirror V8 log editor compatibility fix.
// V8 removed the legacy edit form IDs that app.js ed() still references.
(() => {
  'use strict';

  const MODAL_ID = 'pfc-log-edit-modal';
  const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  function closeEditor() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.remove();
  }

  function currentRows() {
    try {
      return (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : [];
    } catch (_) {
      return [];
    }
  }

  function defaultMeal() {
    try {
      if (typeof getAutoTime === 'function') return getAutoTime();
    } catch (_) {}
    const h = new Date().getHours();
    if (h < 11) return '朝';
    if (h < 17) return '昼';
    return '晩';
  }

  function persist(rows) {
    try {
      if (typeof sv === 'function') sv();
      else localStorage.setItem('tf_dat', JSON.stringify(rows));
    } catch (_) {
      localStorage.setItem('tf_dat', JSON.stringify(rows));
    }
    try { if (typeof ren === 'function') ren(); } catch (_) {}
    try { if (typeof upd === 'function') upd(); } catch (_) {}
  }

  function openEditor(index) {
    const rows = currentRows();
    const item = rows[index];
    if (!item) return;

    closeEditor();

    const overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '食事記録を編集');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '2147483646',
      background: 'rgba(0,0,0,.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '18px',
      boxSizing: 'border-box'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      width: 'min(460px, 100%)', maxHeight: '90vh', overflowY: 'auto',
      background: '#fff', borderRadius: '18px', padding: '18px',
      boxSizing: 'border-box', boxShadow: '0 18px 60px rgba(0,0,0,.28)',
      color: '#102033'
    });

    card.innerHTML = `
      <div style="font-size:18px;font-weight:900;margin-bottom:14px;">食事記録を編集</div>
      <label style="display:block;font-size:12px;font-weight:800;margin-bottom:5px;">食品名</label>
      <input data-k="name" type="text" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-bottom:12px;">
      <label style="display:block;font-size:12px;font-weight:800;margin-bottom:5px;">食事</label>
      <select data-k="time" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-bottom:12px;">
        <option value="朝">朝</option><option value="昼">昼</option><option value="晩">晩</option><option value="間食">間食</option>
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <label style="font-size:12px;font-weight:800;">P (g)<input data-k="p" type="number" min="0" step="0.1" inputmode="decimal" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-top:5px;"></label>
        <label style="font-size:12px;font-weight:800;">F (g)<input data-k="f" type="number" min="0" step="0.1" inputmode="decimal" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-top:5px;"></label>
        <label style="font-size:12px;font-weight:800;">C (g)<input data-k="c" type="number" min="0" step="0.1" inputmode="decimal" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-top:5px;"></label>
        <label style="font-size:12px;font-weight:800;">A (g)<input data-k="a" type="number" min="0" step="0.1" inputmode="decimal" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-top:5px;"></label>
      </div>
      <label style="display:block;font-size:12px;font-weight:800;margin-top:12px;">kcal<input data-k="kcal" type="number" min="0" step="1" inputmode="decimal" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ccd6d1;border-radius:10px;font-size:16px;margin-top:5px;"></label>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button type="button" data-action="cancel" style="flex:1;padding:12px;border:1px solid #ccd6d1;border-radius:11px;background:#fff;font-weight:800;">キャンセル</button>
        <button type="button" data-action="save" style="flex:1;padding:12px;border:0;border-radius:11px;background:#187a51;color:#fff;font-weight:900;">更新する</button>
      </div>`;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const q = key => card.querySelector(`[data-k="${key}"]`);
    q('name').value = String(item.N || '').replace(/^🤖\s*/, '');
    q('time').value = ['朝', '昼', '晩', '間食'].includes(item.time) ? item.time : defaultMeal();
    q('p').value = num(item.P);
    q('f').value = num(item.F);
    q('c').value = num(item.C);
    q('a').value = num(item.A);
    q('kcal').value = Math.round(num(item.Cal));

    const save = () => {
      const name = String(q('name').value || '').trim();
      if (!name) return q('name').focus();

      const p = num(q('p').value);
      const f = num(q('f').value);
      const c = num(q('c').value);
      const a = num(q('a').value);
      const kcalText = String(q('kcal').value || '').trim();
      const kcal = kcalText === ''
        ? Math.round(p * 4 + f * 9 + c * 4 + a * 7)
        : Math.round(num(kcalText));
      if ([p, f, c, a, kcal].some(v => v < 0 || !Number.isFinite(v))) return;

      const aiPrefix = /^🤖\s*/.test(String(item.N || '')) ? '🤖 ' : '';
      item.N = aiPrefix + name;
      item.time = q('time').value;
      item.P = p;
      item.F = f;
      item.C = c;
      item.A = a;
      item.Cal = kcal;

      persist(rows);
      closeEditor();
      try {
        if (typeof showToast === 'function') showToast('食事記録を更新しました');
      } catch (_) {}
    };

    card.querySelector('[data-action="cancel"]').addEventListener('click', closeEditor);
    card.querySelector('[data-action="save"]').addEventListener('click', save);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeEditor(); });
    card.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeEditor();
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save();
    });
    setTimeout(() => q('name').focus(), 0);
  }

  function install() {
    window.ed = openEditor;
    const version = document.querySelector('.app-build-version');
    if (version && /V36/.test(version.textContent || '')) version.textContent = 'V36.1 AI2';
    console.info('[PFC] V8 log editor compatibility fix active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
