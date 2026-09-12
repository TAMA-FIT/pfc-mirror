export const LIVE_GUARD_VERSION='v1.7.28-mext-grounded';

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
  const unresolved=unresolvedItems(items).map(item=>({
    ref:item.ref||'',
    name:item.canonicalName||item.name||'',
    candidates:Array.isArray(item.candidateNames)?item.candidateNames.slice(0,5):[]
  }));
  return `__PFC_MEXT_RESOLUTION_REQUIRED__ attempt=${attempt}. これは画面に読み上げるためのユーザー発話ではなく内部制御です。直前の実ユーザー発話は「${String(userText||'').trim()}」。対象=${JSON.stringify(unresolved)}。このアプリでは飲食店・チェーン店・市販ブランドの公式Web検索を通常経路から外し、文部科学省「日本食品標準成分表」を栄養値の正本にしています。まず対象を最も近い文科省食品名へ正規化して同じrefをname updateしてください。単一食品で表現しにくければ、文科省食品名と推定量だけをcomponents=[{name,amount,unit}]として同じrefへupdateしてください。あなた自身の内部知識からp/f/c/kcalを生成・送信してはいけません。nutritionSource="ai-estimate"は禁止です。ユーザーがパッケージやメニュー表示のP/F/Cを実際に明示した場合だけuser-labelを使えます。候補や構成を決めるのに重要な情報が1点だけ不足する場合は、その一点だけ短く確認してください。ready=trueになるまで登録案内は禁止。まずTool Callを実行し、この内部文を読み上げないでください。`;
}

// Compatibility export retained because live-v1720 still imports it. In MEXT-only
// mode the Web lookup adapter never returns verified, so this should not normally run.
export function buildOfficialResolvedMessage({item,ready=false}={}){
  const ref=String(item?.ref||'');const ev=item?.nutritionEvidence||{};
  const next=ready
    ? '現在のDraftはready=trueです。数値を言い直さず「画面の内容で合っていれば登録ボタンを押してください。」と短く案内してください。'
    : 'この項目は確認済みです。まだ未確定項目が残るため登録案内はせず、残りの確認だけを続けてください。';
  return `__PFC_MEXT_RESULT_SYNC__ ref=${ref}. アプリが文科省データに基づく値をDraftへ反映済みです。source=${String(ev.sourceLabel||'文部科学省 日本食品標準成分表')} serving=${String(ev.servingLabel||'')} kcal=${Number(ev.kcal)||0} P=${Number(ev.p)||0} F=${Number(ev.f)||0} C=${Number(ev.c)||0}。この値を変更・補完・推測し直さないでください。${next}`;
}

function n1(v){const n=Number(v);return Number.isFinite(n)?String(Math.round(n*10)/10):''}
export function evidenceMacroLine(item={}){
  const ev=item?.nutritionEvidence;if(!ev)return '';
  const p=n1(ev.p),f=n1(ev.f),c=n1(ev.c),k=Number(ev.kcal);if(p===''||f===''||c==='')return '';
  const kcal=Number.isFinite(k)&&k>0?`${Math.round(k)} kcal ・ `:'';
  return `${kcal}P ${p}g / F ${f}g / C ${c}g`;
}
