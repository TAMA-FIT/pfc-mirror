export const HOTFIX_VERSION='v1.7.18';

const FREE_TIER_OVERRIDE='【v1.7.18 Free Tier最優先ルール】現在の無料運用ではGoogle Searchとofficial-webを使用しません。Food Masterで未解決になった食品は、ユーザーがパッケージ等のP/F/Cを明示している場合はuser-labelを最優先してください。明示値が無い場合は、Food Master候補が明確に同一食品なら候補へ更新して再解決し、それでも未解決なら、あなたが持つ商品・料理の内部知識を使い、必要なら一般的な料理構成で補完して、同じターン内に必ず p/f/c と nutritionSource="ai-estimate"、servingLabel を同じrefへ update_meal_draft で送ってください。kcalは分かる・推定できる場合は送ってください。栄養値を完全に思い出せなくても、現実的な目安を作ってAI推定として登録可能にしてください。未解決のまま会話だけで止めてはいけません。update_meal_draft の結果が ready=false の間は「登録ボタンを押してください」と案内してはいけません。ready=true になってからのみ登録を案内してください。';

const INTERNAL_NEXT_ACTION='Free TierではWeb検索不可。まずcandidateNamesに明確な同一食品があればその名前へupdateして再解決してください。候補で解決できなければ、ユーザー明示P/F/Cが無い限り、あなたの内部知識または合理的な料理推定から p/f/c + nutritionSource="ai-estimate" + servingLabel（kcalは分かれば付与）を同じrefへ直ちにupdate_meal_draftしてください。音声返答より先に実行し、ready=falseのまま登録案内をしないでください。';

function stripConflictingSearchInstructions(text){
  return String(text||'')
    .split('\n')
    .filter(line=>{
      const s=line.trim();
      if(!s)return true;
      if(s.includes('unresolved の食品だけ、Google Searchを使って'))return false;
      if(s.includes('公式の正確な商品栄養情報を確認できた場合だけ'))return false;
      if(s.includes('Food Masterで未解決かつ公式情報も確認できない場合は'))return false;
      return true;
    })
    .join('\n')
    .replaceAll('質問・Google検索・音声返答','質問・音声返答');
}

export function sanitizeLiveSetupPayload(payload){
  if(!payload||typeof payload!=='object'||!payload.setup)return payload;
  const setup=payload.setup;
  if(Array.isArray(setup.tools)){
    setup.tools=setup.tools.filter(tool=>!(tool&&typeof tool==='object'&&Object.prototype.hasOwnProperty.call(tool,'googleSearch')));
  }
  const parts=setup.systemInstruction?.parts;
  if(Array.isArray(parts)){
    for(const part of parts){
      if(!part||typeof part.text!=='string')continue;
      part.text=stripConflictingSearchInstructions(part.text);
      if(!part.text.includes(FREE_TIER_OVERRIDE))part.text+=`\n${FREE_TIER_OVERRIDE}`;
    }
  }
  return payload;
}

export function augmentToolResponsePayload(payload){
  const responses=payload?.toolResponse?.functionResponses;
  if(!Array.isArray(responses))return payload;
  for(const entry of responses){
    const result=entry?.response?.result;
    if(!result||result.ready!==false||!Array.isArray(result.draft))continue;
    const unresolved=result.draft.filter(item=>item?.status==='unresolved'||item?.unresolved===true);
    if(!unresolved.length)continue;
    result.freeTierNextAction=INTERNAL_NEXT_ACTION;
    result.unresolvedRefs=unresolved.map(item=>item.ref).filter(Boolean);
  }
  return payload;
}

function installVersionBadgeStyle(){
  if(typeof document==='undefined'||document.getElementById('pfc-v1718-version-style'))return;
  const style=document.createElement('style');
  style.id='pfc-v1718-version-style';
  style.textContent='.app-build-version{font-size:0!important}.app-build-version::after{content:"v1.7.18";font-size:14px!important}';
  document.head.appendChild(style);
}

function install(){
  installVersionBadgeStyle();
  const WS=globalThis.WebSocket;
  if(!WS?.prototype||WS.prototype.__pfcFreeTierSearchHotfix)return;
  const originalSend=WS.prototype.send;
  Object.defineProperty(WS.prototype,'__pfcFreeTierSearchHotfix',{value:true,configurable:true});
  WS.prototype.send=function(data){
    if(typeof data==='string'){
      try{
        let payload=JSON.parse(data);
        if(payload?.setup)payload=sanitizeLiveSetupPayload(payload);
        if(payload?.toolResponse)payload=augmentToolResponsePayload(payload);
        data=JSON.stringify(payload);
      }catch{}
    }
    return originalSend.call(this,data);
  };
}

install();
