export const LIVE_GUARD_VERSION='v1.7.20';

const NON_FOOD_ONLY=/^(?:はい|うん|いいえ|いや|普通|普通のやつ|普通の量|一般的な量|それ|これ|同じ|わからない|分からない|以上|おわり|終わり|ありがとう|ok|オーケー)$/i;

export function normalizeProvisionalFoodName(raw=''){
  let text=String(raw||'').normalize('NFKC').trim();
  text=text.replace(/[。！？!?]+$/g,'').trim();
  if(!text||NON_FOOD_ONLY.test(text))return '';
  text=text.replace(/^(?:えっと|あの|今日は|今日|さっき|今|あと)\s*/,'').trim();
  text=text.replace(/(?:を)?(?:食べました|食べた|食いました|食った|いただきました|頂きました|食べています|食べてます)$/,'').trim();
  text=text.replace(/(?:です|でした)$/,'').trim();
  return NON_FOOD_ONLY.test(text)?'':text;
}

export function unresolvedItems(items=[]){
  return (Array.isArray(items)?items:[]).filter(item=>item?.unresolved===true||item?.status==='unresolved');
}

export function shouldRecoverTurn({userText='',ready=false,items=[],attempts=0,maxAttempts=2}={}){
  if(ready||Number(attempts)>=Number(maxAttempts))return false;
  const text=String(userText||'').trim();if(!text)return false;
  if(unresolvedItems(items).length)return true;
  return !items.length&&!!normalizeProvisionalFoodName(text);
}

export function buildInternalRecoveryMessage({userText='',items=[],attempt=1}={}){
  const unresolved=unresolvedItems(items).map(item=>({ref:item.ref||'',name:item.canonicalName||item.name||'',candidates:Array.isArray(item.candidateNames)?item.candidateNames.slice(0,5):[]}));
  return `__PFC_OFFICIAL_LOOKUP_NOT_FOUND__ attempt=${attempt}. これは画面に読み上げるためのユーザー発話ではなく内部制御です。直前の実ユーザー発話は「${String(userText||'').trim()}」。Google Searchによる公式栄養情報検索は完了し、公式値を確認できなかった対象=${JSON.stringify(unresolved)}。candidateNamesに明確な同一食品があればそのrefを候補名へupdateしてFood Master再解決。そうでなければユーザー明示P/F/Cが含まれている時はuser-label、含まれていなければ最後の手段として内部知識または合理的な料理推定からp/f/c + nutritionSource="ai-estimate" + servingLabelを同じrefへupdate_meal_draftしてください。kcalは分かれば付与。ready=trueになるまで登録案内は禁止。まずTool Callを実行し、この内部文を読み上げないでください。`;
}

export function buildOfficialResolvedMessage({item}={}){
  const ref=String(item?.ref||'');const ev=item?.nutritionEvidence||{};
  return `__PFC_OFFICIAL_LOOKUP_RESOLVED__ ref=${ref}. Gemini 2.5 Flash + Google Searchで公式栄養情報を確認し、アプリがDraftへ反映済みです。source=${String(ev.sourceLabel||'公式情報')} serving=${String(ev.servingLabel||'')} kcal=${Number(ev.kcal)||0} P=${Number(ev.p)||0} F=${Number(ev.f)||0} C=${Number(ev.c)||0}。この数値を変更・推測し直さないでください。Draftがready=trueなら「画面の内容で合っていれば登録ボタンを押してください。」と短く案内してください。`;
}

function n1(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*10)/10):''}
export function evidenceMacroLine(item={}){
  const ev=item?.nutritionEvidence;if(!ev)return '';
  const p=n1(ev.p),f=n1(ev.f),c=n1(ev.c),k=Number(ev.kcal);if(p===''||f===''||c==='')return '';
  const kcal=Number.isFinite(k)&&k>0?`${Math.round(k)} kcal ・ `:'';
  return `${kcal}P ${p}g / F ${f}g / C ${c}g`;
}
