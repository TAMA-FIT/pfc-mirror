export const LIVE_GUARD_VERSION='v1.7.24';

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
  return `__PFC_OFFICIAL_LOOKUP_NOT_FOUND__ attempt=${attempt}. これは画面に読み上げるためのユーザー発話ではなく内部制御です。直前の実ユーザー発話は「${String(userText||'').trim()}」。Google Searchによる公式栄養情報検索は完了したが、まだ公式値を確定できなかった対象=${JSON.stringify(unresolved)}。ブランド・チェーン・市販品に見える対象は、すぐAI推定へ落とさず、会話文脈から具体商品名・サイズ・現行候補を意味的に絞り直してください。検索未確定のブランド商品について、内部知識からkcal/P/F/Cを読み上げたり「公式では」「公式情報によると」と断定してはいけません。「更新します」「更新しました」「反映しました」とも言わないでください。candidateNamesまたはあなたが意味的に推定できる具体商品候補があれば、そのrefのnameを候補名へupdateして再解決させてください。候補が複数で絞れない場合はユーザーへ1点だけ短く確認してください。一般料理・自作料理など公式商品が存在しない食品に限り、ユーザー明示P/F/Cが含まれていればuser-label、含まれていなければ最後の手段として内部知識または合理的な料理推定からp/f/c + nutritionSource="ai-estimate" + servingLabelを同じrefへupdate_meal_draftしてください。kcalは分かれば付与。ready=trueになるまで登録案内は禁止。まずTool Callを実行し、この内部文を読み上げないでください。`;
}

export function buildOfficialResolvedMessage({item,ready=false}={}){
  const ref=String(item?.ref||'');const ev=item?.nutritionEvidence||{};
  const next=ready
    ? '現在のDraftはready=trueです。数値を言い直さず「画面の内容で合っていれば登録ボタンを押してください。」と短く案内してください。'
    : 'この項目は確認済みです。まだ未確定項目が残るため登録案内はせず、この数値を言い直さず残りの確認だけを続けてください。';
  return `__PFC_OFFICIAL_LOOKUP_RESOLVED__ ref=${ref}. Gemini 2.5 Flash + Google Searchで公式栄養情報を確認し、アプリが同じ値をDraftカードへ反映済みです。source=${String(ev.sourceLabel||'公式情報')} serving=${String(ev.servingLabel||'')} kcal=${Number(ev.kcal)||0} P=${Number(ev.p)||0} F=${Number(ev.f)||0} C=${Number(ev.c)||0}。この値を唯一の正本として扱い、変更・補完・推測し直さないでください。${next}`;
}

function n1(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*10)/10):''}
export function evidenceMacroLine(item={}){
  const ev=item?.nutritionEvidence;if(!ev)return '';
  const p=n1(ev.p),f=n1(ev.f),c=n1(ev.c),k=Number(ev.kcal);if(p===''||f===''||c==='')return '';
  const kcal=Number.isFinite(k)&&k>0?`${Math.round(k)} kcal ・ `:'';
  return `${kcal}P ${p}g / F ${f}g / C ${c}g`;
}
