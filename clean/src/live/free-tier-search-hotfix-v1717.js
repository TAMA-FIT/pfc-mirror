export const HOTFIX_VERSION='v1.7.17';

const FREE_TIER_OVERRIDE='【v1.7.17 runtime override】現在の無料運用ではGoogle Searchツールを使用しません。Food Masterで未解決の食品は、ユーザーがパッケージ等のP/F/Cを明示できる場合はuser-labelを優先してください。明示値が無い場合は、一般的な料理構成から現実的なP/F/C/kcalを推定しnutritionSource="ai-estimate"として同じrefへupdateできます。official-webは送信しないでください。';

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
      part.text=part.text.replaceAll('質問・Google検索・音声返答','質問・音声返答');
      if(!part.text.includes(FREE_TIER_OVERRIDE))part.text+=`\n${FREE_TIER_OVERRIDE}`;
    }
  }
  return payload;
}

function install(){
  const WS=globalThis.WebSocket;
  if(!WS?.prototype||WS.prototype.__pfcFreeTierSearchHotfix)return;
  const originalSend=WS.prototype.send;
  Object.defineProperty(WS.prototype,'__pfcFreeTierSearchHotfix',{value:true,configurable:true});
  WS.prototype.send=function(data){
    if(typeof data==='string'){
      try{
        const payload=JSON.parse(data);
        if(payload?.setup){
          const sanitized=sanitizeLiveSetupPayload(payload);
          data=JSON.stringify(sanitized);
        }
      }catch{}
    }
    return originalSend.call(this,data);
  };
}

install();
