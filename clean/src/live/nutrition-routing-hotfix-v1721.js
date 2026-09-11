import { LiveMealDraft } from './draft-v1716.js?v=1.7.16';
import { GeminiLiveTransport } from './transport-v1720.js?v=1.7.20';

export const NUTRITION_ROUTING_HOTFIX_VERSION='v1.7.21';
export const OFFICIAL_SEARCH_MARKER='__SEARCH_OFFICIAL__';

const EVIDENCE_KEYS=['p','f','c','kcal','nutritionSource','sourceLabel','sourceUrl','servingLabel'];
let aiFallbackArmed=false;

function text(v){return String(v??'').trim()}
function isAiEstimate(op={}){return text(op.nutritionSource)==='ai-estimate'}
function hasOfficialMarker(op={}){return text(op.sourceLabel)===OFFICIAL_SEARCH_MARKER||op.searchOfficial===true}
function stripEvidence(op={}){const copy={...op};for(const key of EVIDENCE_KEYS)delete copy[key];delete copy.searchOfficial;return copy}
function unique(list=[]){return [...new Set(list.map(text).filter(Boolean))]}

function forceOfficialPending(item){
  if(!item)return;
  const localCandidate=text(item.canonicalName);
  const existingCandidates=Array.isArray(item.candidateNames)?item.candidateNames:[];
  item.foodId=null;
  item.canonicalName='';
  item.nutritionEvidence=null;
  item.unresolved=true;
  item.needsAmount=false;
  item.needsSkin=false;
  item.candidateNames=unique([localCandidate,...existingCandidates]).slice(0,5);
  if(item.assumed){item.amount=null;item.unit=''}
  item.assumed=false;
  item.standardLabel='';
}

function patchDraftRouting(){
  const proto=LiveMealDraft.prototype;
  if(proto.__pfcOfficialFirstV1721)return;
  const original=proto.applyFunctionCall;
  proto.applyFunctionCall=function(call){
    const rawArgs=call?.args&&typeof call.args==='object'?call.args:{};
    const rawOps=Array.isArray(rawArgs.operations)?rawArgs.operations:[];
    const beforeRefs=new Set((Array.isArray(this.items)?this.items:[]).map(x=>x?.ref));
    const fallbackAllowed=aiFallbackArmed;
    const forceFlags=[];
    const safeOps=rawOps.map(op=>{
      const raw=op&&typeof op==='object'?op:{};
      const marked=hasOfficialMarker(raw);
      const prematureAi=isAiEstimate(raw)&&!fallbackAllowed;
      forceFlags.push(marked||prematureAi);
      if(marked||prematureAi)return stripEvidence(raw);
      const copy={...raw};delete copy.searchOfficial;return copy;
    });
    try{
      original.call(this,{...call,args:{...rawArgs,operations:safeOps}});
      const newItems=(Array.isArray(this.items)?this.items:[]).filter(x=>x?.ref&&!beforeRefs.has(x.ref));
      let addIndex=0;
      rawOps.forEach((op,i)=>{
        let item=null;
        if(op?.op==='add')item=newItems[addIndex++]||null;
        else if(op?.ref)item=this.items.find(x=>x?.ref===op.ref)||null;
        if(forceFlags[i])forceOfficialPending(item);
      });
      return this.toolResult();
    }finally{
      if(fallbackAllowed)aiFallbackArmed=false;
    }
  };
  proto.__pfcOfficialFirstV1721=true;
}

export function armAiEstimateFallbackOnce(){aiFallbackArmed=true}
export function clearAiEstimateFallback(){aiFallbackArmed=false}

export function buildRoutingOpeningText(){
  return '__PFC_LIVE_START__ 食事記録を開始しました。最初の一言だけ「何を食べましたか？」と短く尋ねてください。この開始信号だけではDraftを更新しないでください。食事区分が明示されなければmealは省略し、端末時刻によるアプリ補完に任せてください。追加ルーティング規則: 店名・飲食チェーン・メーカー・ブランド・具体的な市販商品が分かる食品は、曖昧な「普通のやつ」等も意味から最有力の商品候補名へ直してnameに入れ、sourceLabel="__SEARCH_OFFICIAL__" を付けて update_meal_draft してください。このマーカーは検索指示であり栄養値ではありません。その時点ではp/f/c/kcal/nutritionSourceを作らないでください。アプリがGemini 2.5 Flash + Google Searchで現行公式商品と栄養値を確認します。一般食品は従来どおりFood Masterを優先してください。';
}

function patchTransportRouting(){
  const proto=GeminiLiveTransport.prototype;
  if(proto.__pfcOfficialFirstV1721)return;
  const originalSendText=proto.sendText;
  proto.sendText=function(value){
    const s=text(value);
    if(s.startsWith('__PFC_OFFICIAL_LOOKUP_NOT_FOUND__'))armAiEstimateFallbackOnce();
    else if(s.startsWith('__PFC_OFFICIAL_LOOKUP_RESOLVED__'))clearAiEstimateFallback();
    return originalSendText.call(this,value);
  };
  proto.sendOpening=function(){this.sendObject({realtimeInput:{text:buildRoutingOpeningText()}})};
  proto.__pfcOfficialFirstV1721=true;
}

patchDraftRouting();
patchTransportRouting();
console.info('[PFC nutrition routing hotfix]',{version:NUTRITION_ROUTING_HOTFIX_VERSION,officialFirst:true});
