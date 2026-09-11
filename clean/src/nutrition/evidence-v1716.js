export const NUTRITION_EVIDENCE_TYPES = Object.freeze(['user-label','official-web','ai-estimate']);

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function round1(v){return Math.round(num(v)*10)/10}

export function macroKcal({p=0,f=0,c=0}={}) {
  return Math.round(num(p)*4 + num(f)*9 + num(c)*4);
}

export function normalizeNutritionEvidence(raw={}) {
  const sourceType=String(raw.sourceType||raw.nutritionSource||'').trim();
  if(!NUTRITION_EVIDENCE_TYPES.includes(sourceType))throw new Error('invalid nutrition source');
  const p=Number(raw.p),f=Number(raw.f),c=Number(raw.c);
  if(!Number.isFinite(p)||p<0)throw new Error('invalid p');
  if(!Number.isFinite(f)||f<0)throw new Error('invalid f');
  if(!Number.isFinite(c)||c<0)throw new Error('invalid c');
  const supplied=raw.kcal==null||raw.kcal===''?null:Number(raw.kcal);
  if(supplied!=null&&(!Number.isFinite(supplied)||supplied<=0))throw new Error('invalid kcal');
  const sourceUrl=String(raw.sourceUrl||'').trim();
  if(sourceType==='official-web'&&!sourceUrl)throw new Error('official-web requires sourceUrl');
  return {
    sourceType,
    p:round1(p),f:round1(f),c:round1(c),
    kcal:supplied==null?macroKcal({p,f,c}):Math.round(supplied),
    kcalDerived:supplied==null,
    sourceLabel:String(raw.sourceLabel||'').trim(),
    sourceUrl,
    servingLabel:String(raw.servingLabel||'').trim()||'1食'
  };
}

export function chooseNutritionMode(item={}) {
  const ev=item.nutritionEvidence||null;
  if(ev?.sourceType==='user-label')return {mode:'evidence',evidence:ev};
  if(item.foodId){
    if(!item.unresolved&&!item.needsSkin&&!item.needsAmount&&Number(item.amount)>0)return {mode:'trusted-db',evidence:null};
    return {mode:'pending',evidence:null};
  }
  if(ev?.sourceType==='official-web'||ev?.sourceType==='ai-estimate')return {mode:'evidence',evidence:ev};
  return {mode:'pending',evidence:null};
}

export function evidenceSourceText(evidence={}) {
  if(evidence.sourceType==='user-label')return 'パッケージ・表示値';
  if(evidence.sourceType==='official-web')return evidence.sourceLabel||'公式情報';
  if(evidence.sourceType==='ai-estimate')return 'AI推定・目安';
  return '';
}

export function buildEvidenceRecord(item, id=Date.now()) {
  const {mode,evidence}=chooseNutritionMode(item);
  if(mode!=='evidence'||!evidence)return null;
  const name=String(item.canonicalName||item.name||'食品').trim()||'食品';
  const serving=String(evidence.servingLabel||'1食').trim()||'1食';
  const meal=['朝','昼','晩','間食'].includes(item.meal)?item.meal:'間食';
  return {
    id:Number(id)||Date.now(),
    N:`${name}(${serving})`,
    P:evidence.p,F:evidence.f,C:evidence.c,A:0,Cal:evidence.kcal,
    U:serving,
    time:meal,
    _clean:{
      schema:3,
      nutritionSource:evidence.sourceType,
      sourceLabel:evidence.sourceLabel||evidenceSourceText(evidence),
      sourceUrl:evidence.sourceUrl||'',
      servingLabel:serving,
      kcalDerived:!!evidence.kcalDerived,
      externalNutrition:true
    }
  };
}
