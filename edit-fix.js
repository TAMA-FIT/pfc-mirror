// PFC Mirror V8 Food Master log editor.
// Normal UX edits food/amount/unit/meal and recalculates PFC automatically.
// Detailed nutrient fields remain available as an explicit manual override.
(() => {
  'use strict';

  const VERSION = '2.0.0';
  const MODAL_ID = 'pfc-log-edit-modal';
  const round1 = v => Math.round((Number(v) || 0) * 10) / 10;
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const rows = () => (typeof lst !== 'undefined' && Array.isArray(lst)) ? lst : [];
  const db = () => window.__PFC_DB_V3__ || null;
  const multi = () => window.__PFC_DB_V3_MULTIUNIT__ || null;
  const engine = () => window.__PFC_MEAL_ENGINE_V50__ || null;

  function closeEditor() { document.getElementById(MODAL_ID)?.remove(); }
  function stripName(name) {
    const e = engine();
    if (e?.stripRecordName) return e.stripRecordName(name);
    return String(name || '').replace(/^🤖\s*/,'').replace(/[（(][^()（）]*[0-9][^()（）]*[)）]\s*$/,'').trim();
  }
  function resolveFood(record, name) {
    const saved = Number(record?._dbv3?.index);
    if (Number.isFinite(saved) && db()?.get?.(saved)) return { index:saved, ...db().get(saved) };
    return engine()?.safeResolveFood?.(stripName(name || record?.N)) || null;
  }
  function unitIdForLabel(index, label) {
    const wanted = engine()?.unitCanon?.(label) || String(label || '');
    const units = multi()?.getUnits?.(index) || [];
    return units.find(u => (engine()?.unitCanon?.(u.label) || u.label) === wanted)?.id || units[0]?.id || '';
  }
  function neatAmount(v, unit) {
    const n = Math.max(0.01, Number(v) || 1);
    if (unit === 'g' || unit === 'ml') return Math.round(n * 10) / 10;
    return Math.round(n * 100) / 100;
  }
  function inferAmount(record, index, unitId) {
    if (Number(record?._dbv3?.amount) > 0) return Number(record._dbv3.amount);
    const meta = db()?.get?.(index);
    if (!meta) return 1;
    const baseAmount = Number(meta.input?.defaultAmount || meta.nutritionBasis?.amount || 1);
    const base = multi()?.scaleInput?.(index, baseAmount, unitId);
    if (!base) return baseAmount;
    const pairs = [['P','p'],['F','f'],['C','c'],['A','a']];
    let dot = 0, denom = 0;
    for (const [rk,bk] of pairs) {
      const b = Number(base[bk] || 0), a = Number(record?.[rk] || 0);
      if (b > 0.05 && Number.isFinite(a)) { dot += a * b; denom += b * b; }
    }
    let ratio = denom > 0 ? dot / denom : 0;
    if (!(ratio > 0) && Number(base.kcal) > 0) ratio = Number(record?.Cal || 0) / Number(base.kcal);
    if (!(ratio > 0)) ratio = 1;
    return neatAmount(baseAmount * ratio, multi()?.getUnits?.(index)?.find(u => u.id === unitId)?.label || '');
  }
  function scaleExisting(original, amount, baselineAmount) {
    const ratio = Number(amount) > 0 && Number(baselineAmount) > 0 ? Number(amount) / Number(baselineAmount) : 1;
    return { p:round1(original.P * ratio), f:round1(original.F * ratio), c:round1(original.C * ratio), a:round1((original.A || 0) * ratio), kcal:Math.round(original.Cal * ratio) };
  }
  function persist() {
    if (typeof sv === 'function') sv();
    else (window.mirrorStorage || window.localStorage).setItem('tf_dat', JSON.stringify(rows()));
    if (typeof ren === 'function') ren();
    if (typeof upd === 'function') upd();
  }

  function openEditor(index) {
    const original = rows()[index];
    if (!original) return;
    closeEditor();

    let matched = resolveFood(original);
    let baselineUnknownAmount = 1;
    let manualOverride = false;

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.innerHTML = `
      <div class="fm-edit-card" role="dialog" aria-modal="true" aria-label="食事記録を編集">
        <div class="fm-edit-head"><div><b>食事記録を編集</b><small id="fm-source"></small></div><button type="button" id="fm-close">×</button></div>
        <label>食品名<input id="fm-name" type="text" value="${esc(stripName(original.N))}"></label>
        <div class="fm-grid fm-qty">
          <label>量<input id="fm-amount" type="number" inputmode="decimal" min="0.01" step="0.1"></label>
          <label>単位<select id="fm-unit"></select></label>
          <label>食事<select id="fm-meal"><option>朝</option><option>昼</option><option>晩</option><option>間食</option></select></label>
        </div>
        <div id="fm-preview" class="fm-preview"></div>
        <details class="fm-details"><summary>栄養値を細かく編集</summary>
          <div class="fm-detail-note"><span id="fm-detail-status">自動計算値</span><button type="button" id="fm-reset-auto">自動計算に戻す</button></div>
          <div class="fm-grid fm-macros">
            <label>P (g)<input id="fm-p" type="number" inputmode="decimal" step="0.1"></label>
            <label>F (g)<input id="fm-f" type="number" inputmode="decimal" step="0.1"></label>
            <label>C (g)<input id="fm-c" type="number" inputmode="decimal" step="0.1"></label>
            <label>A (g)<input id="fm-a" type="number" inputmode="decimal" step="0.1"></label>
            <label>kcal<input id="fm-cal" type="number" inputmode="decimal" step="1"></label>
          </div>
        </details>
        <div id="fm-status" class="fm-status"></div>
        <div class="fm-actions"><button type="button" id="fm-cancel">キャンセル</button><button type="button" id="fm-save">更新する</button></div>
      </div>`;
    document.body.appendChild(modal);
    ensureStyle();

    const $ = id => modal.querySelector('#' + id);
    const nameEl = $('fm-name'), amountEl = $('fm-amount'), unitEl = $('fm-unit'), mealEl = $('fm-meal');
    mealEl.value = ['朝','昼','晩','間食'].includes(original.time) ? original.time : '間食';

    function unitsForMatch(preserveLabel) {
      unitEl.innerHTML = '';
      if (matched && Number.isFinite(Number(matched.index))) {
        const list = multi()?.getUnits?.(Number(matched.index)) || [];
        if (list.length) list.forEach(u => { const o=document.createElement('option'); o.value=u.id; o.textContent=u.label; unitEl.appendChild(o); });
        else { const o=document.createElement('option'); o.value=''; o.textContent=matched.input?.defaultUnit || matched.nutritionBasis?.unit || 'g'; unitEl.appendChild(o); }
        const savedLabel = preserveLabel || original?._dbv3?.unit || matched.input?.defaultUnit || '';
        unitEl.value = unitIdForLabel(Number(matched.index), savedLabel);
        if (!unitEl.value && unitEl.options.length) unitEl.selectedIndex = 0;
      } else {
        const o=document.createElement('option'); o.value='serving'; o.textContent='人前'; unitEl.appendChild(o);
      }
    }

    function autoNutrition() {
      const amount = Math.max(0.01, num(amountEl.value) || 1);
      if (matched && Number.isFinite(Number(matched.index))) {
        const scaled = multi()?.scaleInput?.(Number(matched.index), amount, unitEl.value);
        if (scaled) return {p:round1(scaled.p),f:round1(scaled.f),c:round1(scaled.c),a:round1(scaled.a),kcal:Math.round(scaled.kcal)};
      }
      return scaleExisting(original, amount, baselineUnknownAmount);
    }
    function fillNutrition(force = false) {
      const n = autoNutrition();
      if (!manualOverride || force) {
        $('fm-p').value=n.p; $('fm-f').value=n.f; $('fm-c').value=n.c; $('fm-a').value=n.a; $('fm-cal').value=n.kcal;
      }
      $('fm-preview').innerHTML = `<b>${n.kcal.toLocaleString()} kcal</b><span>P ${n.p}g</span><span>F ${n.f}g</span><span>C ${n.c}g</span>${n.a ? `<span>A ${n.a}g</span>` : ''}`;
      $('fm-source').textContent = matched?.source?.label ? `公式値：${matched.source.label}` : (matched?._source?.label ? `公式値：${matched._source.label}` : 'AI/手動の基準値から比例計算');
      $('fm-detail-status').textContent = manualOverride ? '手動補正中' : '自動計算値';
    }
    function setInitialAmount() {
      if (matched && Number.isFinite(Number(matched.index))) amountEl.value = inferAmount(original, Number(matched.index), unitEl.value);
      else amountEl.value = baselineUnknownAmount;
      fillNutrition(true);
    }
    function rematch() {
      const previousUnit = unitEl.options[unitEl.selectedIndex]?.textContent || '';
      const next = engine()?.safeResolveFood?.(nameEl.value.trim()) || null;
      const changed = Number(next?.index) !== Number(matched?.index);
      matched = next;
      unitsForMatch(previousUnit);
      if (changed) {
        const meta = matched && db()?.get?.(Number(matched.index));
        amountEl.value = matched ? Number(meta?.input?.defaultAmount || meta?.nutritionBasis?.amount || 1) : 1;
        manualOverride = false;
      }
      fillNutrition(true);
      $('fm-status').textContent = matched ? '' : 'Food Masterに完全一致しない食品です。量変更は現在値を基準に比例計算します。';
    }

    unitsForMatch(); setInitialAmount();
    amountEl.addEventListener('input',()=>fillNutrition());
    unitEl.addEventListener('change',()=>fillNutrition());
    nameEl.addEventListener('change',rematch);
    ['fm-p','fm-f','fm-c','fm-a','fm-cal'].forEach(id => $(id).addEventListener('input',()=>{ manualOverride=true; $('fm-detail-status').textContent='手動補正中'; }));
    $('fm-reset-auto').onclick=()=>{ manualOverride=false; fillNutrition(true); };
    $('fm-close').onclick=$('fm-cancel').onclick=closeEditor;
    modal.addEventListener('click',e=>{ if(e.target===modal) closeEditor(); });

    $('fm-save').onclick=()=>{
      const amount = Math.max(0.01, num(amountEl.value) || 1);
      const meal = mealEl.value;
      let next = null;
      if (matched && Number.isFinite(Number(matched.index))) {
        const unitLabel = unitEl.options[unitEl.selectedIndex]?.textContent || '';
        next = engine()?.buildTrustedRecord?.(Number(matched.index), amount, unitLabel, meal, original.id) || null;
      }
      if (!next) {
        const scaled = autoNutrition();
        next = { ...original, id:original.id, N:nameEl.value.trim() || stripName(original.N), P:scaled.p,F:scaled.f,C:scaled.c,A:scaled.a,Cal:scaled.kcal,time:meal,
          _qty:{amount,unit:'人前',basis:'relative-to-original',editorVersion:VERSION} };
      }
      if (manualOverride) {
        next.P=Math.max(0,num($('fm-p').value)); next.F=Math.max(0,num($('fm-f').value)); next.C=Math.max(0,num($('fm-c').value)); next.A=Math.max(0,num($('fm-a').value)); next.Cal=Math.max(0,Math.round(num($('fm-cal').value)));
        next._nutritionOverride={manual:true,editorVersion:VERSION,at:Date.now()};
      }
      next.time=meal;
      next._editedBy={kind:'Food Master editor',version:VERSION,at:Date.now()};
      rows()[index]=next;
      persist();
      closeEditor();
      if (typeof window.showToast === 'function') window.showToast('食事記録を更新しました');
    };
  }

  function ensureStyle() {
    if (document.getElementById('pfc-foodmaster-edit-style')) return;
    const style=document.createElement('style'); style.id='pfc-foodmaster-edit-style';
    style.textContent=`
      #${MODAL_ID}{position:fixed;inset:0;z-index:100000;background:rgba(10,25,19,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px}
      #${MODAL_ID} .fm-edit-card{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:18px;box-shadow:0 18px 55px rgba(0,0,0,.25);font-family:inherit;color:#17231e}
      .fm-edit-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.fm-edit-head b{font-size:19px}.fm-edit-head small{display:block;color:#187a51;font-size:10px;margin-top:4px}.fm-edit-head button{border:0;background:#edf4f0;border-radius:50%;width:34px;height:34px;font-size:23px;color:#52655c}
      .fm-edit-card label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:#64756d}.fm-edit-card input,.fm-edit-card select{box-sizing:border-box;width:100%;border:1px solid #d8e2dc;border-radius:11px;background:#fff;padding:11px 12px;font-size:16px;color:#17231e}
      .fm-grid{display:grid;gap:9px}.fm-qty{grid-template-columns:1fr 1fr 1fr;margin-top:11px}.fm-macros{grid-template-columns:repeat(2,1fr)}
      .fm-preview{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:13px 0;padding:12px;border-radius:13px;background:#edf7f2}.fm-preview b{font-size:18px;color:#126a46;margin-right:4px}.fm-preview span{font-size:11px;font-weight:800;color:#506159}
      .fm-details{border:1px solid #e0e8e3;border-radius:13px;padding:10px 12px}.fm-details summary{font-size:12px;font-weight:900;cursor:pointer}.fm-detail-note{display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px;font-size:10px;color:#6b7c73}.fm-detail-note button{border:0;background:#edf4f0;color:#187a51;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:800}
      .fm-status{min-height:18px;margin-top:8px;font-size:10px;color:#8a6b3b}.fm-actions{display:grid;grid-template-columns:1fr 2fr;gap:9px;margin-top:14px}.fm-actions button{border:0;border-radius:13px;padding:13px;font-size:14px;font-weight:900}.fm-actions #fm-cancel{background:#edf1ef;color:#596961}.fm-actions #fm-save{background:#187a51;color:#fff}
      @media(max-width:520px){.fm-qty{grid-template-columns:1fr 1fr}.fm-qty label:last-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  window.ed = openEditor;
  window.__PFC_LOG_EDITOR__={version:VERSION,foodMaster:true,amountDriven:true,manualNutritionOverride:true,open:openEditor};
})();
