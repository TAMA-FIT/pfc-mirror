const KEY='tf_voice_bench_v1';
const META={
  voice:{code:'A',name:'最速Live',roles:'耳・脳・口＝会話Live'},
  chat:{code:'B',name:'専用耳Live',roles:'耳＝文字起こしLive / 脳・口＝会話Live'},
  auto:{code:'C',name:'完全分離',roles:'耳＝文字起こしLive / 脳＝Flash Lite / 口＝会話Live'}
};
const read=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const fmt=v=>Number.isFinite(v)?`${Math.round(v)} ms`:'—';
function avg(rows,key){const a=rows.map(x=>x.metrics?.[key]).filter(Number.isFinite);return a.length?Math.round(a.reduce((p,c)=>p+c,0)/a.length):null}
function summary(mode){const rows=read().filter(x=>x.mode===mode&&x.ok!==false),rated=rows.filter(x=>typeof x.accurate==='boolean');return{n:rows.length,response:avg(rows,'responseMs'),transcript:avg(rows,'transcriptMs'),brain:avg(rows,'brainMs'),mouth:avg(rows,'mouthMs'),accuracy:rated.length?Math.round(rated.filter(x=>x.accurate).length/rated.length*100):null,rated:rated.length}}
function latest(){return read().at(-1)||null}
function cardHtml(){const last=latest(),mode=document.querySelector('.voice-mode.selected')?.dataset.mode||'voice',s=summary(mode),m=META[mode];const lm=last?.mode===mode?last.metrics:null;return `<div class="voice-lab-card" id="voice-lab-card"><div class="vl-head"><div><b>VOICE LAB 測定器</b><small>${m.code} ${m.name} / ${m.roles}</small></div><span>${s.n}回</span></div><div class="vl-now"><div><small>今回 応答</small><strong>${fmt(lm?.responseMs)}</strong></div><div><small>文字確定</small><strong>${fmt(lm?.transcriptMs)}</strong></div><div><small>脳</small><strong>${fmt(lm?.brainMs)}</strong></div><div><small>口</small><strong>${fmt(lm?.mouthMs)}</strong></div></div><div class="vl-avg">平均 応答 <b>${fmt(s.response)}</b>　文字 <b>${fmt(s.transcript)}</b>　脳 <b>${fmt(s.brain)}</b>　口 <b>${fmt(s.mouth)}</b></div><div class="vl-rate"><span>聞き取り精度 ${s.accuracy==null?'未評価':`${s.accuracy}% (${s.rated})`}</span><button data-bench-rate="1">聞き取り ○</button><button data-bench-rate="0">×</button><button class="vl-clear" data-bench-clear>測定クリア</button></div></div>`}
function decorate(){
  const sheet=document.querySelector('#voice-sheet');if(!sheet)return;
  for(const [mode,m] of Object.entries(META)){
    const b=sheet.querySelector(`.voice-mode[data-mode="${mode}"]`);if(!b)continue;
    const want=`<b>${m.code} ${m.name}</b><small>${m.roles}</small>`;
    if(b.innerHTML!==want)b.innerHTML=want;
  }
  const tabs=sheet.querySelector('.mode-tabs');if(tabs&&!sheet.querySelector('#voice-lab-card'))tabs.insertAdjacentHTML('afterend',cardHtml());
  const status=sheet.querySelector('.sv4-listen-status');const mic=sheet.querySelector('.sv4-mic');
  if(status&&mic?.classList.contains('listening')&&/約3秒|聞いています/.test(status.textContent||''))status.textContent='Liveで聞いています。話し終わると自動で確定します';
}
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;decorate()})};
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('pfc-voice-bench',schedule);
addEventListener('click',e=>{
  const rate=e.target.closest('[data-bench-rate]');if(rate){const rows=read();if(rows.length){rows[rows.length-1].accurate=rate.dataset.benchRate==='1';localStorage.setItem(KEY,JSON.stringify(rows));dispatchEvent(new CustomEvent('pfc-voice-bench'))}return}
  if(e.target.closest('[data-bench-clear]')){localStorage.removeItem(KEY);dispatchEvent(new CustomEvent('pfc-voice-bench'));return}
  if(e.target.closest('.voice-mode'))setTimeout(schedule,0);
});
schedule();
