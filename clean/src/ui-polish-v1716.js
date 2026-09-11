export const UI_V1716_VERSION='v1.7.16';

function loadCss(){
  if(typeof document==='undefined'||document.getElementById('pfc-ui-polish-v1716-css'))return;
  const link=document.createElement('link');
  link.id='pfc-ui-polish-v1716-css';
  link.rel='stylesheet';
  link.href=new URL('../assets/ui-polish-v1716.css?v=1.7.16',import.meta.url).href;
  document.head.appendChild(link);
}
function readRecords(){
  try{const x=JSON.parse(localStorage.getItem('tf_dat')||'[]');return Array.isArray(x)?x:[]}catch{return []}
}
function sourceLabel(record){
  const clean=record?._clean||{};
  const src=String(clean.nutritionSource||'');
  if(src==='MEXT Food Master')return '文科省';
  if(src==='Food Master')return 'Food Master';
  if(src==='user-label')return clean.sourceLabel||'パッケージ表示';
  if(src==='official-web')return clean.sourceLabel||'公式情報';
  if(src==='ai-estimate')return 'AI推定';
  return '';
}
function patchVersion(){
  // Build/version ownership belongs to the current app/Live runtime.
  // This legacy UI polish module must never overwrite the badge with v1.7.16.
}
function patchRecordCards(){
  const records=readRecords();
  const byId=new Map(records.map(x=>[String(x?.id??''),x]));
  for(const card of document.querySelectorAll('#today-records .record-card')){
    const record=byId.get(String(card.dataset.id||''));
    if(!record)continue;
    const display=String(record?._clean?.displayAmount||'').trim();
    const subtitle=card.querySelector('.record-main span');
    if(display&&subtitle&&subtitle.dataset.v1716Amount!=='1'){
      const meal=subtitle.textContent.match(/^(朝|昼|晩|間食)・/)?.[1]||'';
      subtitle.textContent=meal?`${meal}・${display}`:display;
      subtitle.dataset.v1716Amount='1';
    }
    if(!card.querySelector('.record-source-badge')){
      const label=sourceLabel(record);
      if(label){
        const badge=document.createElement('div');
        badge.className=`record-source-badge ${record?._clean?.nutritionSource==='ai-estimate'?'estimate':''}`;
        badge.textContent=label;
        card.appendChild(badge);
      }
    }
  }
}
function patchSourceNote(){
  for(const id of ['view-home','view-settings']){
    const host=document.getElementById(id);
    if(!host||host.querySelector('.nutrition-source-note'))continue;
    const note=document.createElement('div');
    note.className='nutrition-source-note';
    note.textContent='栄養データ：文部科学省「日本食品標準成分表」・Food Master・公式商品情報等を参照。AI推定は目安として表示します。';
    host.appendChild(note);
  }
}
let queued=false;
function queuePatch(){
  if(queued||typeof document==='undefined')return;
  queued=true;
  requestAnimationFrame(()=>{
    queued=false;
    loadCss();patchVersion();patchRecordCards();patchSourceNote();
  });
}
if(typeof document!=='undefined'){
  const start=()=>{
    queuePatch();
    const observer=new MutationObserver(queuePatch);
    observer.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
}
