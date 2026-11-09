(function(){
'use strict';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v==null||v===''||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2});
const rub=v=>v==null?'—':'₽\u202f'+number(v);
const pct=(a,b)=>b?Math.round(a/b*100):0;
const MONTH_NAMES=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const monthLabel=m=>Piot.validMonth(m)?MONTH_NAMES[Number(m.slice(5))-1]+' '+m.slice(0,4):'За всё время';
const shortLabel=k=>k==='Без даты'?k:k.length===7?MONTH_NAMES[Number(k.slice(5))-1].slice(0,3)+' '+k.slice(2,4):k.slice(8,10)+'.'+k.slice(5,7);
const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Компактные логотипы банков. Они отображаются только в разделе «Банки». */
(function installCompactBankLogos(){
  if(document.getElementById('piot-compact-bank-logos'))return;
  const style=document.createElement('style');
  style.id='piot-compact-bank-logos';
  style.textContent=`
    .bank-logo-image{
      display:block;width:96px!important;max-width:96px!important;height:28px!important;
      padding:4px 8px!important;box-sizing:border-box;object-fit:contain;object-position:center;
      background:rgba(255,255,255,.9);border:1px solid rgba(220,230,242,.95);
      border-radius:9px;box-shadow:0 2px 7px rgba(20,40,70,.045);
      transition:transform .2s ease,box-shadow .2s ease;
    }
    .bank-card:hover .bank-logo-image{
      transform:translateY(-1px);box-shadow:0 4px 11px rgba(20,40,70,.09);
    }
    .bank-head{align-items:center;gap:10px}
    @media(max-width:850px){
      .bank-logo-image{
        width:88px!important;max-width:88px!important;height:26px!important;padding:4px 7px!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
const path={
  home:'M3 10l9-7 9 7M5 9v11h5v-6h4v6h5V9',
  banks:'M3 9l9-6 9 6H3m2 3v7m5-7v7m4-7v7m5-7v7M3 21h18',
  finance:'M20 6c0 2-4 3-8 3s-8-1-8-3 4-3 8-3 8 1 8 3zm0 0v5c0 2-4 3-8 3s-8-1-8-3V6m16 5v5c0 2-4 3-8 3s-8-1-8-3v-5',
  trend:'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5',
  plan:'M8 4H5v17h14V4h-3M8 2h8v5H8V2m0 12 3 3 5-6',
  table:'M6 2h9l4 4v16H6V2m9 0v5h4M9 11h7m-7 4h7m-7 4h5',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m-2-6h4l1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3l-2-2 2-4 3 1 3-1 1-3',
  edit:'M4 20l1-5L17 3l4 4L9 19l-5 1m10-14 4 4',
  download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4'
};
const icon=n=>'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(path[n]||path.table)+'"/></svg>';
const PAGES=[['home','Главная'],['banks','Банки'],['finance','Финансы'],['trend','Динамика'],['plan','План задач'],['table','Заявки'],['settings','Настройки']];
const TITLES={home:'Главная',banks:'Банки',finance:'Финансы',trend:'Графики и динамика',plan:'План задач',table:'Заявки',settings:'Настройки'};
const s={data:null,page:'home',month:'',gran:'month',tab:'money',tablePage:1,sort:'amount',direction:-1,paid:'',
  filter:{q:'',partner:'',status:'',task:'',responsible:'',priority:'',bank:''},
  draft:{},invalid:{},timer:null,saving:null,saveError:'',configDraft:null,configDirty:false,loaded:false,fx:true};
let chartId=0;
const CHARTS=Object.create(null);
function cfg(){return s.data.config;}
function fxOn(){return s.data&&cfg().animate&&!reduced();}
function toast(text,error){
  const el=document.createElement('div');el.className='toast'+(error?' err':'');el.textContent=text;
  $('#toasts').append(el);setTimeout(()=>{el.style.opacity=0;el.style.transform='translateY(10px)';setTimeout(()=>el.remove(),300);},5600);
}
function rpc(name,arg){
  // Сначала используем настоящий сервер Google Apps Script.
  // Демо-адаптер нужен только вне HtmlService, например на GitHub Pages.
  if(window.google&&google.script&&google.script.run){
    return new Promise((resolve,reject)=>{
      const runner=google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(e=>reject(Error(e.message||String(e))));
      if(typeof runner[name]!=='function'){
        reject(Error('В Code.gs не найдена серверная функция '+name+'().'));
        return;
      }
      runner[name](arg);
    });
  }
  if(window.PIOT_DEMO)return window.PIOT_DEMO.call(name,arg);
  return Promise.reject(Error('Нет подключения к Google Apps Script. Откройте панель из Google-таблицы.'));
}
function manual(){return s.data.ledger[s.month]||Piot.emptyMonth();}
function detailed(){return Object.values(s.filter).some(Boolean);}
function rows(){return Piot.filter(s.data.records,Object.assign({month:s.month},s.filter),cfg());}
function eventRows(){return Piot.filter(s.data.records,s.filter,cfg());}
function scopedIncome(){return Piot.income(eventRows(),detailed()?{}:s.data.ledger,s.month,cfg());}

/* Значения «—» не анимируем: иначе они превращались в ноль. */
const cVal=(n,money)=>{
  const valid=n!=null&&n!==''&&Number.isFinite(Number(n));
  return `<span${valid?` data-count="${Number(n)}"`:''}${money?' data-money="1"':''}>${money?rub(n):number(n)}</span>`;
};

function playCounters(){
  if(!fxOn())return;
  $$('[data-count]').forEach(el=>{
    const target=Number(el.dataset.count);if(!isFinite(target))return;
    const money=el.dataset.money==='1',t0=performance.now(),dur=820;
    function step(t){
      const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3),v=target*e;
      el.textContent=money?rub(Math.round(v)):number(Math.round(v));
      if(k<1)requestAnimationFrame(step);else el.textContent=money?rub(target):number(target);
    }
    requestAnimationFrame(step);
  });
}
function nav(){
  $('#navigation').innerHTML=PAGES.map(([id,title])=>`
    <button class="navbtn ${s.page===id?'active':''}" data-page="${id}" ${s.page===id?'aria-current="page"':''}>
      ${icon(id)}<span class="nav-label">${title}</span></button>`).join('');
}
function options(){
  const years={};
  const months=(Array.isArray(s.data.months)?s.data.months:[]).filter(Piot.validMonth).slice().sort();
  months.forEach(m=>(years[m.slice(0,4)]||(years[m.slice(0,4)]=[])).push(m));
  $('#month').innerHTML='<option value="">За всё время</option>'+
    Object.keys(years).sort().map(y=>'<optgroup label="'+y+' год">'+
      years[y].map(m=>'<option value="'+m+'"'+(m===s.month?' selected':'')+'>'+monthLabel(m)+'</option>').join('')+'</optgroup>').join('');
  $('#month').value=s.month;
}
function saveStatus(state){
  const pending=Object.keys(s.draft).length>0;
  const text=state||(s.saveError?'Не сохранено':s.saving?'Сохраняю...':pending?'Есть изменения':'Сохранено');
  $('#topSave').textContent=text;
  $('#topSave').className='pill '+(s.saveError?'err':pending||s.saving?'warn':'ok');
  $$('[data-save-status]').forEach(el=>{el.textContent=s.saveError||text;el.className='save-status '+(s.saveError?'error':pending||s.saving?'waiting':'');});
}
function edit(field,value){
  try{
    if(!s.month)throw Error('Выберите конкретный месяц');
    const val=value.trim()===''?null:Number(value);
    Piot.validatePatch({[field]:val});
    delete s.invalid[field];s.draft[field]=val;s.saveError='';
    clearTimeout(s.timer);s.timer=setTimeout(()=>flush().catch(()=>{}),950);
    saveStatus();
  }catch(e){s.invalid[field]=true;s.saveError=e.message;clearTimeout(s.timer);saveStatus();}
}
async function flush(){
  clearTimeout(s.timer);
  if(Object.keys(s.invalid).length)throw Error('Исправьте некорректный ввод');
  if(s.saving)await s.saving;
  if(!Object.keys(s.draft).length)return;
  const month=s.month,patch=Object.assign({},s.draft),revision=manual().revision;
  s.saving=rpc('apiSaveMonth',{month,patch,revision}).then(result=>{
    s.data.ledger[month]=result.value;
    Object.keys(patch).forEach(k=>{if(s.draft[k]===patch[k])delete s.draft[k];});
    s.saveError='';
  }).catch(e=>{
    s.saveError=e.message;
    if(String(e.message).includes('CONFLICT')){
      $('#conflictDraft').textContent=Object.keys(s.draft).map(k=>k+': '+s.draft[k]).join(' · ');
      if(!$('#conflict').open)$('#conflict').showModal();
    }
    toast(e.message,true);throw e;
  }).finally(()=>{s.saving=null;saveStatus();});
  saveStatus();await s.saving;
  if(Object.keys(s.draft).length)return flush();
  if(!document.activeElement.matches('[data-field]'))render({fx:false});
}
function numericInput(field,label){
  const value=Object.prototype.hasOwnProperty.call(s.draft,field)?s.draft[field]:manual()[field];
  const disabled=!s.month||detailed(),auto=manual().auto[field];
  return `<input type="number" min="0" max="9999999999" step="${['sp','esp'].includes(field)?'.01':'1'}"
    data-field="${field}" aria-label="${h(label)}" value="${value==null?'':value}"
    placeholder="${auto!=null?'Авто: '+auto:'Введите значение'}"
    ${disabled?'disabled':''} ${s.invalid[field]?'aria-invalid="true"':''}>`;
}
function kpi(label,valueHtml,meta){
  return `<section class="glass kpi"><div class="label">${h(label)}</div><strong>${valueHtml}</strong><div class="meta">${h(meta||'')}</div></section>`;
}
/* ══ FIX 2: card — восстановлен </p> ══ */
function card(title,body,sub='',extra=''){
  return `<section class="glass card"><header class="cardhead"><div><h2>${h(title)}</h2>${sub?`<p>${h(sub)}</p>`:''}</div>${extra}</header>${body}</section>`;
}
/* ══ FIX 3: empty — вернули стрелку ══ */
const empty=text=>`<div class="empty"><strong>Нет данных</strong>${h(text||'Измените период или фильтры.')}</div>`;

/* ══ FIX 4: filters — map(v=>`...`) ══ */
function filters(){
  const sets={partner:'Все партнёры',status:'Все статусы',task:'Все передачи',responsible:'Все ответственные',priority:'Все приоритеты'};
  function sel(k){
    const vals=[...new Set(s.data.records.map(r=>r[k==='task'?'taskStatus':k]).filter(Boolean))].sort();
    return `<select data-filter="${k}" aria-label="${sets[k]}"><option value="">${sets[k]}</option>${
      vals.map(v=>`<option value="${h(v)}"${s.filter[k]===v?' selected':''}>${h(v)}</option>`).join('')}</select>`;
  }
  return `<div class="filterbar">
    <input type="search" data-filter="q" aria-label="Поиск" placeholder="Поиск по клиенту, номеру, партнёру..." value="${h(s.filter.q)}">
    ${sel('partner')}
    <select data-filter="bank" aria-label="Банк"><option value="">Все банки</option>${
      Piot.BANKS.map(b=>`<option value="${b.id}"${s.filter.bank===b.id?' selected':''}>${b.name}</option>`).join('')}</select>
    <button class="btn small" data-clear-filters>Сбросить</button>
    <details><summary>Ещё фильтры${detailed()?' · активны':''}</summary>
    <div class="advanced">${sel('status')}${sel('task')}${sel('responsible')}${sel('priority')}</div></details>
  </div>${detailed()?'<div class="inactive-warning">Фильтры активны — ручные итоги месяца не распределяются по фильтрам.</div>':''}`;
}

/* ══ FIX 5: chart — 12 восстановленных svg+= и let d= ══ */
function chart(labels,series,opts={}){
  series=(series||[]).filter(Boolean);
  if(!labels.length||!series.length)return empty('Нет записей для графика.');
  const uid='c'+(++chartId);
  const W=1000,H=320,L=70,R=opts.dual?70:28,T=26,B=52;
  const plotW=W-L-R,plotH=H-T-B,baseY=T+plotH,n=labels.length;
  const max={left:0,right:0};
  series.forEach(d=>{const ax=d.axis||'left';(d.values||[]).forEach(v=>{const x=Number(v)||0;if(x>max[ax])max[ax]=x;});});
  function niceMax(v,money){
    if(!v)return money?1000:10;
    const raw=v/4,power=Math.pow(10,Math.floor(Math.log10(raw)));
    const k=raw/power,step=(k<=1?1:k<=2?2:k<=2.5?2.5:k<=5?5:10)*power;
    return Math.max(step,Math.ceil(v*1.14/step)*step);
  }
  max.left=niceMax(max.left,!!opts.money);
  max.right=niceMax(max.right,false);
  const allBars=series.every(d=>d.type==='bar');
  const band=plotW/Math.max(1,n);
  const xLine=i=>n<2?L+plotW/2:L+(i/(n-1))*plotW;
  const xBand=i=>L+(i+.5)*band;
  const xOf=i=>allBars?xBand(i):xLine(i);
  const yOf=(v,ax)=>baseY-Math.max(0,Number(v)||0)/(max[ax||'left']||1)*plotH;
  const fmt=(v,money)=>money?(v>=1e6?(v/1e6).toFixed(1)+' млн':v>=1e3?Math.round(v/1e3)+' тыс':Math.round(v)+''):Math.round(v).toLocaleString('ru-RU');
  function smooth(pts){
    if(!pts.length)return '';
    if(pts.length<2)return `M${pts[0][0]},${pts[0][1]}`;
    let d=`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],dx=(b[0]-a[0])*.42;
      d+=`C${(a[0]+dx).toFixed(1)},${a[1].toFixed(1)} ${(b[0]-dx).toFixed(1)},${b[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
    }
    return d;
  }
  let svg=`<svg class="chart-svg${fxOn()?' anim':''}" id="${uid}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${h(opts.title||'График')}">
    <title>${h(opts.title||'График')}</title><defs>
    <filter id="${uid}-glow" x="-20%" y="-40%" width="140%" height="180%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0b2b45" flood-opacity=".18"/></filter>`;
  series.forEach((d,i)=>{
    svg+=`<linearGradient id="${uid}-g${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${d.color}" stop-opacity="${d.type==='bar'?'.95':'.32'}"/>
      <stop offset="1" stop-color="${d.color}" stop-opacity="${d.type==='bar'?'.45':'.01'}"/></linearGradient>`;
  });
  svg+=`</defs>`;
    for(let i=0;i<=4;i++){
    const yy=(T+plotH*i/4).toFixed(1);
    svg+=`<line class="gridline" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" style="animation-delay:${i*50}ms"/>
      <text class="axis-label" x="${L-10}" y="${+yy+4}" text-anchor="end">${fmt(max.left*(1-i/4),!!opts.money)}</text>`;
    if(opts.dual)svg+=`<text class="axis-label" x="${W-R+10}" y="${+yy+4}" text-anchor="start">${fmt(max.right*(1-i/4),false)}</text>`;
  }
  svg+=`<line class="axis-base" x1="${L}" y1="${baseY}" x2="${W-R}" y2="${baseY}"/>`;
  svg+=`<line class="crosshair" id="${uid}-cross" x1="0" y1="${T-6}" x2="0" y2="${baseY}"/>`;
  const barCount=series.filter(d=>d.type==='bar').length;
  let barIdx=0;
  series.forEach((d,di)=>{
    const ax=d.axis||'left';
    svg+=`<g data-s="${di}">`;
    if(d.type==='bar'){
      const groupW=Math.min(52,band*.72);
      const barW=Math.max(3,groupW/Math.max(1,barCount)*.86);
      const off=(barIdx-(barCount-1)/2)*(barW+2);
      (d.values||[]).forEach((v,i)=>{
        let x=xOf(i)+off-barW/2;
        x=Math.max(L+1,Math.min(W-R-barW-1,x));
        const y=yOf(v,ax),hh=Math.max(0,baseY-y);
        svg+=`<rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${hh.toFixed(1)}"
          rx="${Math.min(7,barW/2).toFixed(1)}" fill="url(#${uid}-g${di})" stroke="${d.color}" stroke-opacity=".35"
          style="transform-origin:${x.toFixed(1)}px ${baseY}px;animation-delay:${i*32+di*60}ms"></rect>`;
      });
      barIdx++;
    }else{
      const pts=(d.values||[]).map((v,i)=>[xOf(i),yOf(v,ax)]);
      if(d.area!==false&&pts.length>1)
        svg+=`<path class="chart-area" d="${smooth(pts)}L${pts[pts.length-1][0].toFixed(1)},${baseY} L${pts[0][0].toFixed(1)},${baseY} Z" fill="url(#${uid}-g${di})" stroke="none"/>`;
      if(pts.length>1)svg+=`<path class="chart-line" d="${smooth(pts)}" stroke="${d.color}" filter="url(#${uid}-glow)"/>`;
      pts.forEach((p,i)=>{
        svg+=`<circle class="chart-point" data-p="${i}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2"
          fill="#fff" stroke="${d.color}" stroke-width="2.6" style="animation-delay:${340+i*26}ms"></circle>`;
      });
    }
    svg+=`</g>`;
  });
  const stride=Math.max(1,Math.ceil(n/(plotW/88)));
  labels.forEach((label,i)=>{
    if(i%stride===0||i===n-1){
      const t=String(label);
      svg+=`<text class="x-label" x="${xOf(i).toFixed(1)}" y="${H-16}" text-anchor="middle">${h(t.length>16?t.slice(0,14)+'...':t)}</text>`;
    }
  });
  const xs=[];
  labels.forEach((l,i)=>{
    xs.push(xOf(i));
    const hw=allBars?band:plotW/Math.max(1,n-1||1);
    let x=xOf(i)-hw/2;
    x=Math.max(L,Math.min(W-R-1,x));
    svg+=`<rect class="hit" data-hit="${uid}" data-i="${i}" x="${x.toFixed(1)}" y="${T-8}" width="${Math.min(hw,W-R-x).toFixed(1)}" height="${(plotH+14).toFixed(1)}"/>`;
  });
  svg+=`</svg>`;
  CHARTS[uid]={labels,xs,series:series.map(d=>({name:d.name,color:d.color,values:d.values||[],money:!!opts.money&&(d.axis||'left')==='left'}))};
  const legend=`<div class="legend">${series.map((d,i)=>
    `<button type="button" data-legend="${uid}" data-s="${i}"><i class="dot" style="--color:${d.color}"></i>${h(d.name)}</button>`).join('')}</div>`;
  const table=`<details class="chart-details"><summary>Точные значения</summary>
    <div class="table-wrap"><table><thead><tr><th>Период</th>${series.map(d=>`<th>${h(d.name)}</th>`).join('')}</tr></thead>
    <tbody>${labels.map((l,i)=>`<tr><td>${h(l)}</td>${series.map(d=>`<td class="number">${number(d.values[i])}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></details>`;
  return `<div class="chart" data-chart="${uid}"><div class="chart-scroll">${svg}</div>${legend}${table}</div>`;
}

/* ══ FIX 6: sparkline — let d= / d+= ══ */
function sparkline(values,color){
  const v=values.length?values:[0];
  const W=240,H=44,max=Math.max(1,...v),n=v.length;
  const x=i=>n<2?W/2:i/(n-1)*W;
  const y=k=>H-2-(k/max)*(H-8);
  const pts=v.map((k,i)=>[x(i),y(k)]);
  let d=`M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],dx=(b[0]-a[0])*.42;
    d+=`C${(a[0]+dx).toFixed(1)},${a[1].toFixed(1)} ${(b[0]-dx).toFixed(1)},${b[1].toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  }
  const gid='sp'+(++chartId);
  return `<svg class="spark${fxOn()?' chart-svg anim':''}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path class="chart-area" d="${d}L${W},${H} L0,${H} Z" fill="url(#${gid})"/>
    <path class="chart-line" d="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>
    <circle class="chart-point" cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="3.4" fill="#fff" stroke="${color}" stroke-width="2.4"/>
  </svg>`;
}

/* ══ FIX 7: donut — map(x=>`...`) ══ */
function donut(items,title){
  items=items.filter(x=>x.value>0);
  const total=items.reduce((a,x)=>a+x.value,0);
  if(!total)return empty('Положительных значений нет.');
  const circ=2*Math.PI*68;let off=0;
  const arcs=items.map(x=>{
    const len=x.value/total*circ;
    const el=`<circle class="donut-arc" cx="90" cy="90" r="68" fill="none" stroke="${x.color}" stroke-width="26"
      stroke-linecap="butt" data-len="${len.toFixed(2)}" data-rest="${(circ-len).toFixed(2)}"
      stroke-dasharray="${fxOn()?'0 '+circ.toFixed(2):len.toFixed(2)+' '+(circ-len).toFixed(2)}"
      stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 90 90)">
      <title>${h(x.name+': '+number(x.value)+' · '+(x.value/total*100).toFixed(1)+'%')}</title></circle>`;
    off+=len;return el;
  }).join('');
  return `<div class="donut-wrap">
    <svg class="donut" viewBox="0 0 180 180" role="img" aria-label="${h(title)}">${arcs}
      <text class="center-count" x="90" y="88" text-anchor="middle">${number(total)}</text>
      <text class="center-label" x="90" y="108" text-anchor="middle">${h(title)}</text></svg>
    <div class="donut-legend">${items.map(x=>`<div><i class="dot" style="--color:${x.color}"></i><span>${h(x.name)}</span><b>${number(x.value)}</b></div>`).join('')}</div>
  </div>`;
}
function heroPlan(){
  const a=Piot.eventSummary(eventRows(),cfg(),s.month);
  const m=manual(),plan=s.month&&!detailed()?m.plan:null,done=a.done;
  const hasPlan=plan!=null;
  const p=hasPlan?Math.min(100,pct(done,plan)):0;
  const left=plan!=null?Math.max(0,plan-done):null;
  const c=2*Math.PI*64,off=c*(1-p/100);
  return `<section class="hero">
    <div class="hero-top">
      <div><span class="hero-kicker">ВЫПОЛНЕНИЕ ПЛАНА</span><h2>Выполнение плана</h2></div>
      <button class="text-btn" data-page="plan">Открыть план →</button>
    </div>
    <div class="hero-body">
      <svg class="ring" viewBox="0 0 160 160" role="img" aria-label="Выполнение плана ${p}%">
        <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5ee6b0"/><stop offset="1" stop-color="#009a66"/></linearGradient></defs>
        <circle class="ring-bg" cx="80" cy="80" r="64"/>
        <circle class="ring-fg" cx="80" cy="80" r="64" transform="rotate(-90 80 80)"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${fxOn()?c.toFixed(1):off.toFixed(1)}" data-ringoff="${off.toFixed(1)}"/>
        <text class="ring-val" x="80" y="84" text-anchor="middle">${hasPlan?p+'%':'—'}</text>
        <text class="ring-cap" x="80" y="102" text-anchor="middle">${hasPlan?'от плана':'план не задан'}</text>
      </svg>
      <div class="hero-right">
        <div class="big-progress"><i style="width:${p}%"></i></div>
        <div class="hero-metrics">
          <div class="hero-metric"><span>ВЫПОЛНЕНО</span><b>${cVal(done)}</b></div>
          <div class="hero-metric"><span>ПЛАН</span><b>${plan==null?'—':cVal(plan)}</b></div>
          <div class="hero-metric"><span>ОСТАЛОСЬ</span><b>${left==null?'—':cVal(left)}</b></div>
        </div>
        <p class="hero-note">${hasPlan?'До выполнения плана осталось <b>'+number(left)+'</b> задач. Учёт — по дате статуса.':'Укажите план на выбранный месяц в разделе «Настройки → Доходы и план».'}</p>
      </div>
    </div>
  </section>`;
}
function heroOpen(){
  const a=Piot.eventSummary(eventRows(),cfg(),s.month);
  const act=Piot.activityPeriods(eventRows(),s.month?'day':'month',cfg(),s.month);
  const series=act.map(x=>Math.max(0,x.total-x.done));
  const share=a.total?Math.round(a.open/a.total*100):0;
  return `<section class="hero blue">
    <div class="hero-top">
      <div><span class="hero-kicker">ТЕКУЩАЯ НАГРУЗКА</span><h2>Открытые заявки</h2></div>
      <button class="text-btn" data-open-table>Все заявки →</button>
    </div>
    <div class="hero-body" style="gap:14px">
      <div style="flex:1;min-width:180px">
        <div class="hero-big">${cVal(a.open)}</div>
        <div class="hero-sub">${share}% от созданных за период · незавершённые</div>
        <div class="hero-metrics">
          <div class="hero-metric"><span>ВСЕГО</span><b>${cVal(a.total)}</b></div>
          <div class="hero-metric"><span>ВЫПОЛНЕНО</span><b>${cVal(a.done)}</b></div>
          <div class="hero-metric"><span>ЗАКРЫТО</span><b>${cVal(a.closed)}</b></div>
        </div>
      </div>
    </div>
    <div style="margin-top:12px;position:relative;z-index:1">${sparkline(series.length?series:[0],'#3d8ef0')}</div>
  </section>`;
}

/* ══ FIX 8: taskStatusDashboard — восстановлен тернарник isEmpty ? ... : ... ══ */
function taskStatusDashboard(){
  const statusScope=Object.assign({},s.filter,{task:''});
  const source=Piot.filter(s.data.records,Object.assign({month:s.month},statusScope),cfg()).filter(r=>r.source==='main');
  const total=source.length;
  const priority=[
    {name:'Клиент сам установил',tone:'',index:'01',label:'ПРИОРИТЕТ No 1',caption:'Клиент самостоятельно установил решение'},
    {name:'Клиент настроен с нашей помощью',tone:'assist',index:'02',label:'ПРИОРИТЕТ No 2',caption:'Настройка выполнена при поддержке команды'}
  ];
  const matches=(v,t)=>{const a=Piot.norm(v),b=Piot.norm(t);return a===b||a.indexOf(b+':')===0||a.indexOf(b+' ')===0;};
  const countFor=t=>source.filter(r=>matches(r.taskStatus,t)).length;
  const share=k=>total?Math.round(k/total*100):0;
  const featured=priority.map(p=>{
    const k=countFor(p.name),part=share(k),active=s.filter.task===p.name;
    return `<button type="button" class="priority-status-card ${p.tone}${active?' active':''}" data-task-status="${h(p.name)}" aria-pressed="${active}">
      <span class="priority-kicker"><span class="priority-index">${p.index}</span>${p.label}</span>
      <span class="priority-status-title">${h(p.name)}</span>
      <span class="priority-status-caption">${p.caption}</span>
      <span class="priority-count-row"><strong>${cVal(k)}</strong><span>заявок <b>${part}%</b></span></span>
      <span class="priority-track"><i style="width:${part}%"></i></span>
      <span class="priority-status-foot">Открыть заявки <span aria-hidden="true">→</span></span></button>`;
  }).join('');
  const counts=new Map();
  source.forEach(r=>{const name=String(r.taskStatus||'').trim()||'Без статуса';counts.set(name,(counts.get(name)||0)+1);});
  const others=Array.from(counts.entries())
    .filter(([name])=>name==='Без статуса'||!priority.some(p=>matches(name,p.name)))
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ru'));
  const otherHtml=others.length?`<div class="priority-other-list">${others.map(([name,k])=>{
      const part=share(k),isEmpty=name==='Без статуса',active=!isEmpty&&s.filter.task===name;
      const row=`<span class="priority-other-name">${h(name)}</span>
        <span class="priority-other-value">${number(k)} <small>${part}%</small></span>
        <span class="priority-other-track"><i style="width:${part}%"></i></span>`;
      return isEmpty
        ? `<div class="priority-other-row muted-row">${row}</div>`
        : `<button type="button" class="priority-other-row${active?' active':''}" data-task-status="${h(name)}" aria-pressed="${active}">${row}</button>`;
    }).join('')}</div>`:'<div class="priority-other-empty">Других статусов пока нет.</div>';
  return card('Результат подключения клиентов',
    `<div class="priority-status-grid">${featured}</div>
     <div class="priority-other-heading"><span>Остальные статусы</span><span>Количество и доля</span></div>${otherHtml}`,
    'Два главных результата подключения. Нажмите, чтобы отфильтровать.',
    '<span class="priority-section-badge">2 ГЛАВНЫХ СТАТУСА</span>');
}
function incomeBlock(extraBtn){
  const inc=scopedIncome();
  return card('Доходы',
    `<div class="kpis income-kpis">
      ${kpi('Доход',cVal(inc.lp+inc.esp,true),'Установки и ЕСП')}
      ${kpi('СП',cVal(inc.sp,true),'Поступления по СП')}
      ${kpi('Прочее',cVal(inc.other,true),'Другие поступления')}
      ${kpi('Итого',cVal(inc.total,true),'Общий доход')}
    </div>`,
    'Финансы · '+(detailed()?'по выбранным фильтрам':'за выбранный период'),
    extraBtn||'<button class="text-btn" data-page="finance">Подробнее →</button>'
  ).replace('<section class="glass card">','<section class="glass card income-overview">');
  /* ══ FIX 9: home — let html= ══ */
function home(){
  // Главная содержит выполнение плана и приоритеты, но не карточки банков.
  // Карточки банков выводятся только на отдельной вкладке.
  const a=Piot.eventSummary(eventRows(),cfg(),s.month);
  let html=`<div class="hero-grid">${heroPlan()}${heroOpen()}</div>`;
  html+=incomeBlock();
  html+=filters();
  if(cfg().showStatuses)html+=taskStatusDashboard();
  html+=`<div class="kpis home-summary">
    ${kpi('Всего заявок',cVal(a.total),'По дате создания')}
    ${kpi('Выполнено',cVal(a.done),'По дате статуса')}
    ${kpi('Закрыто',cVal(a.closed),'По дате статуса')}
    ${kpi('Оплачено',cVal(a.paid),'Платные установки')}
  </div>`;
  if(cfg().showCharts){
    const p=Piot.activityPeriods(eventRows(),s.month?'day':'month',cfg(),s.month);
    html+=card('Поток заявок',chart(p.map(x=>shortLabel(x.key)),[
      {name:'Создано',values:p.map(x=>x.total),color:'#62b5ff'},
      {name:'Выполнено',values:p.map(x=>x.done),color:'#00a56a'},
      {name:'Закрыто',values:p.map(x=>x.closed),color:'#9060ed',area:false}
    ],{title:'Поток заявок'}),'Создано — по дате создания. Выполнено и закрыто — по дате статуса.');
  }
  return html;
}
const BANK_LOGOS={
  vtb:'https://upload.wikimedia.org/wikipedia/commons/7/7c/VTB_Logo_2018.svg',
  tochka:'https://upload.wikimedia.org/wikipedia/commons/3/3b/Tochka_Logo.svg',
  alfa:'https://upload.wikimedia.org/wikipedia/commons/8/87/Alfabank_logo.png',
  psb:'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZyJ1dGYtOD8NCjxzdmcgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDEwMDAgMzA1LjMiIHhtbDpzcGFjZT0icHJlc2VydmUiPjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+LnN0MHtmaWxsOiMyQzJEODQ7fS5zdDF7ZmlsbDojRjI2MTI2O308L3N0eWxlPjxwb2x5Z29uIGNsYXNzPSJzdDEiIHBvaW50cz0iMjAzLjYsMCAxMDEuOCwxMDEuOCAyMDMuNiwxMDEuOCAyMDMuNiwzMDUuMyAzMDUuMywyMDMuOCAzMDUuMywwICIvPjxwb2x5Z29uIGNsYXNzPSJzdDAiIHBvaW50cz0iMTAxLjgsMzA1LjMgMjAzLjYsMjAzLjYgMTAxLjgsMjAzLjYgMTAxLjgsMCAwLDEwMS41IDAsMzA1LjMgIi8+PC9zdmc+'
};

/* ══ FIX 10: banks — html+= и </section> ══ */
function banks(){
  const all=eventRows().filter(r=>r.source==='main');
  const scoped=rows().filter(r=>r.source==='main');
  const bs=Piot.BANKS.map(b=>{
    const recs=all.filter(r=>Piot.bank(r,cfg())===b.id);
    const sum=Piot.eventSummary(recs,cfg(),s.month);
    const per=Piot.periods(recs.filter(r=>!s.month||(r.date||'').slice(0,7)===s.month),s.month?'day':'month',cfg());
    return Object.assign({},b,sum,{spark:per.map(x=>x.revenue)});
  });
  const unknown=scoped.filter(r=>!Piot.bank(r,cfg())).length;
  const matched=bs.reduce((n,b)=>n+b.total,0);
  const done=bs.reduce((n,b)=>n+b.done,0);
  const revenue=bs.reduce((n,b)=>n+b.revenue,0);
  let html=filters();
  if(!cfg().showBanks)return html+card('Банки',empty('Карточки банков отключены в настройках.'));
  html+=`<div class="bank-summary-grid">
    ${kpi('Распознано',cVal(matched),'Заявок по банкам')}
    ${kpi('Выручка банков',cVal(revenue,true),'Без счетов')}
    ${kpi('Выполнено',cVal(done),'По дате статуса')}
    ${kpi('Не распределено',cVal(unknown),'Банк не найден')}
  </div>`;
  html+=`<div class="bank-grid">${bs.map(b=>`
    <section class="glass bank-card" style="--brand:${b.color};--color:${b.color}" data-bank="${b.id}">
      <div class="bank-head">
        <img class="bank-logo-image" src="${BANK_LOGOS[b.id]}" alt="${h(b.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <span class="bank-pct">${b.total?pct(b.done,b.total)+'% выполнено':'нет данных'}</span>
      </div>
      <div class="bank-revenue-label">ВЫРУЧКА</div>
      <div class="bank-revenue">${cVal(b.revenue,true)}</div>
      <div class="bank-spark">${sparkline(b.spark.length?b.spark:[0],b.color)}</div>
      <div class="bank-metrics">
        ${[['Пришло',b.total],['Оплачено',b.paid],['Выполнено',b.done],['Открыто',b.open]].map(([k,v])=>
          `<div class="mini-glass"><span>${k}</span><b>${number(v)}</b></div>`).join('')}
      </div>
      <button class="text-btn" data-bank="${b.id}">Показать заявки →</button>
    </section>`).join('')}</div>`;
  if(cfg().showCharts){
    html+=`<div class="row-main">
      ${card('Сравнение банков',chart(bs.map(b=>b.name),[
        {name:'Пришло',type:'bar',values:bs.map(b=>b.total),color:'#62a9f5'},
        {name:'Выполнено',type:'bar',values:bs.map(b=>b.done),color:'#20b889'},
        {name:'Оплачено',type:'bar',values:bs.map(b=>b.paid),color:'#9673ed'}
      ],{title:'Сравнение банков'}),'Количество заявок по каждому банку.')}
      ${card('Доля выручки',donut(bs.map(b=>({name:b.name,color:b.color,value:Math.round(b.revenue)})),'₽'),'По сумме установок')}
    </div>`;
    const monthsKeys=[...new Set(all.map(r=>(r.date||'').slice(0,7)).filter(Piot.validMonth))].sort().slice(-12);
    html+=card('Динамика выручки по банкам',chart(monthsKeys.map(shortLabel),
      Piot.BANKS.map(b=>({name:b.name,color:b.color,area:false,
        values:monthsKeys.map(mk=>all.filter(r=>Piot.bank(r,cfg())===b.id&&(r.date||'').slice(0,7)===mk).reduce((n,r)=>n+Piot.rev(r,cfg()),0))})),
      {money:true,title:'Выручка по банкам'}),'Помесячно, последние 12 месяцев. Клик по легенде скрывает банк.');
  }
  html+=card('Рейтинг банков',bs.slice().sort((a,b)=>b.revenue-a.revenue).map(b=>
    `<div class="rank"><span class="rank-name"><i class="dot" style="--color:${b.color}"></i> ${h(b.name)}</span>
     <b>${rub(b.revenue)} <span class="muted">· ${number(b.total)} заявок</span></b></div>`).join(''),
    'Не распределено: '+number(unknown)+' заявок.');
  return html;
}
function granTabs(){
  return `<div class="tabs compact">${[['day','День'],['week','Неделя'],['month','Месяц']].map(([k,v])=>
    `<button data-gran="${k}" class="${s.gran===k?'active':''}">${v}</button>`).join('')}</div>`;
}
function periodChart(rr,title){
  const ps=Piot.periods(rr,s.gran,cfg());
  return card(title,chart(ps.map(x=>shortLabel(x.key)),[
    {name:'Установки · правая ось',type:'bar',axis:'right',values:ps.map(x=>x.paid),color:'#55b3ff'},
    {name:'Выручка, ₽',values:ps.map(x=>x.revenue),color:'#00a56a'}
  ],{title,dual:true,money:true}),'Счета исключены из выручки.',granTabs());
}
function trend(){
  const rr=rows(),ps=Piot.periods(rr,s.gran,cfg());
  let acc=0;const totals=ps.map(x=>acc+=x.revenue);
  let html=filters();
  if(!cfg().showCharts)return html+empty('Графики отключены в настройках.');
  const p=Piot.activityPeriods(eventRows(),s.gran,cfg(),s.month);
  html+=card('Создано и выполнено',chart(p.map(x=>shortLabel(x.key)),[
    {name:'Создано',values:p.map(x=>x.total),color:'#62b5ff'},
    {name:'Выполнено',values:p.map(x=>x.done),color:'#00a56a'},
    {name:'Закрыто',values:p.map(x=>x.closed),color:'#9060ed',area:false}
  ],{title:'Поступление и выполнение'}),'Создано — дата создания. Выполнено/закрыто — дата статуса.',granTabs());
  html+=periodChart(rr,'Выручка и установки');
  html+=`<div class="row2">
    ${card('Доля по банкам',donut(Piot.BANKS.map(b=>({name:b.name,color:b.color,value:rr.filter(r=>Piot.bank(r,cfg())===b.id).length})),'заявок'),'По числу заявок')}
    ${card('Накопительная выручка',chart(ps.map(x=>shortLabel(x.key)),[
      {name:'Выручка ₽',values:totals,color:'#00a56a'}],{money:true,title:'Накопительная выручка'}),'Нарастающий итог')}
  </div>`;
  const wd=[0,0,0,0,0,0,0];
  rr.filter(r=>r.source==='main'&&r.date).forEach(r=>wd[(new Date(r.date+'T12:00:00Z').getUTCDay()+6)%7]++);
  html+=card('Заявки по дням недели',chart(['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
    [{name:'Заявки',type:'bar',values:wd,color:'#61b5f6'}],{title:'Дни недели'}));
  return html;
}
function finance(){
  const rr=rows(),ps=Piot.periods(rr,s.gran,cfg());
  let html=filters()+incomeBlock('<button class="text-btn" data-page="settings">Изменить суммы →</button>');
  if(cfg().showCharts)html+=periodChart(rr,'Выручка и установки');
  const t=`<div class="table-wrap"><table>
    <thead><tr><th>Период</th><th>Заявок</th><th>Платных</th><th>Выручка</th><th>Средний чек</th></tr></thead>
    <tbody>${ps.map(p=>`<tr>
      <td>${h(p.key==='Без даты'?p.key:s.gran==='month'?monthLabel(p.key):p.key)}</td>
      <td>${p.total}</td><td>${p.paid}</td>
      <td class="number">${rub(p.revenue)}</td>
      <td class="number">${rub(p.paid?p.revenue/p.paid:0)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">Доход ЕСП в таблицу не распределяется — входит в общую сумму.</p>`;
  html+=card('Сводка по периодам',ps.length?t:empty(),'',granTabs());
  return html;
}

/* ══ FIX 11: planPage — let html= и корректный вызов card() ══ */
function planPage(){
  const ledger=s.data.ledger,m=ledger[s.month]||Piot.emptyMonth();
  const mm=Piot.monthly(eventRows(),cfg());
  const auto=mm[s.month]||Piot.summary([],cfg()),done=auto.done||0;
  const keys=Object.keys(ledger).sort().reverse();
  let html=`<div class="hero-grid">${heroPlan()}${heroOpen()}</div>`;
  html+=filters()+(!s.month?'<div class="inactive-warning">Выберите месяц, чтобы редактировать план.</div>':'');
  html+=`<div class="kpis">
    ${kpi('План на месяц',s.month&&m.plan!=null?cVal(m.plan):'—')}
    ${kpi('Выполнено',s.month?cVal(done):'—','Автоматически')}
    ${kpi('Осталось',s.month&&m.plan!=null?cVal(Math.max(0,m.plan-done)):'—')}
    ${kpi('Выполнение',m.plan!=null?pct(done,m.plan)+'%':'—')}
  </div>`;
  const table=`<div class="table-wrap"><table>
    <thead><tr><th>Месяц</th><th>План</th><th>Выполнено</th><th>Закрыто</th><th>Выполнение</th></tr></thead>
    <tbody>${keys.map(k=>{const row=ledger[k]||{},a=mm[k]||{done:0,closed:0};
      const pp=row.plan?pct(a.done,row.plan):0;
      return `<tr><td><button class="text-btn" data-select-month="${k}">${monthLabel(k)}</button></td>
        <td>${number(row.plan)}</td><td>${number(a.done)}</td><td>${number(a.closed)}</td>
        <td style="min-width:120px"><div class="progress" style="--color:#00a56a"><i style="width:${Math.min(100,pp)}%"></i></div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  html+=card('История по месяцам',table,'',`<button class="btn small" data-page="settings">${icon('edit')} Изменить</button>`);
  if(cfg().showCharts){
    const recent=keys.slice().sort().slice(-12);
    html+=card('План и выполнение',chart(recent.map(shortLabel),[
      {name:'План',type:'bar',values:recent.map(k=>ledger[k]?(ledger[k].plan||0):0),color:'#a3b1c1'},
      {name:'Выполнено',type:'bar',values:recent.map(k=>mm[k]?mm[k].done:0),color:'#29c58e'}
    ],{title:'План и выполнение'}),'Последние 12 месяцев.');
  }
  return html;
}
const COLS=[['numero','No'],['client','Клиент'],['partner','Партнёр'],['status','Статус'],['taskStatus','Передача'],['amount','Сумма, ₽'],['responsible','Ответственный'],['priority','Приоритет'],['date','Дата создания'],['dateStatus','Дата статуса'],['sla','SLA'],['customer','Заказчик'],['legalEntity','Юр.лицо'],['source','Источник']];
function tableRows2(){
  return rows().filter(r=>
    s.paid==='paid'?Piot.rev(r,cfg())>0:
    s.paid==='invoice'?Piot.isInvoice(r,cfg()):
    s.paid==='zero'?r.amount===0:true
  ).slice().sort((a,b)=>{
    const av=a[s.sort],bv=b[s.sort];
    return(typeof av==='number'?av-bv:String(av||'').localeCompare(String(bv||''),'ru',{numeric:true}))*s.direction;
  });
}

/* ══ FIX 12: tablePage2 — map(([k,v])=>`...`) ══ */
function tablePage2(){
  const rr=tableRows2(),per=cfg().perPage,pages=Math.max(1,Math.ceil(rr.length/per));
  s.tablePage=Math.min(Math.max(1,s.tablePage),pages);
  const part=rr.slice((s.tablePage-1)*per,s.tablePage*per);
  const sum=rr.reduce((a,r)=>a+(s.paid==='invoice'?Math.max(0,r.amount):Piot.rev(r,cfg())),0);
  let html=filters()+`<div class="filterbar">
    <select id="paidFilter" aria-label="Оплата">
      ${[['','Все заявки'],['paid','В выручке'],['invoice','Счета отдельно'],['zero','Без суммы']].map(([k,v])=>`<option value="${k}"${s.paid===k?' selected':''}>${v}</option>`).join('')}
    </select>
    <button class="btn" data-export>${icon('download')} Экспорт CSV</button>
    <span class="pill">${rr.length} строк</span><span class="pill ok">${rub(sum)}</span>
  </div>`;
  html+=`<section class="glass card"><div class="table-wrap"><table>
    <thead><tr>${COLS.map(([key,title])=>`<th><button class="thbtn" data-sort="${key}">${title}${s.sort===key?(s.direction===1?' ↑':' ↓'):''}</button></th>`).join('')}</tr></thead>
    <tbody>${part.map(r=>`<tr>${COLS.map(([key])=>{const v=r[key];
      if(key==='amount')return `<td class="number">${rub(v)}</td>`;
      if(key==='source')return `<td>${v==='noesp'?'Без задачи ЕСП':'Заявка'}</td>`;
      if(key==='status'||key==='taskStatus'||key==='sla'){
        const cls=key==='sla'?(/просроч|наруш/i.test(v||'')?'red':''):Piot.isInvoice(r,cfg())?'orange':Piot.isDone(r,cfg())?'green':'';
        return `<td><span class="badge ${cls}">${h(v||'—')}</span></td>`;
      }
      return `<td title="${h(v||'')}">${h(v||'—')}</td>`;
    }).join('')}</tr>`).join('')+(part.length?'':'<tr><td colspan="14" style="text-align:center;color:#8898aa;padding:28px">Нет заявок по фильтру</td></tr>')}
    </tbody></table></div>
    <div class="tablefoot">
      <span>${(s.tablePage-1)*per+(rr.length?1:0)}–${Math.min(s.tablePage*per,rr.length)} из ${rr.length}</span>
      <div class="pager">
        <button class="btn" data-pag="-1" ${s.tablePage===1?'disabled':''}>‹</button>
        <span>${s.tablePage} / ${pages}</span>
        <button class="btn" data-pag="1" ${s.tablePage===pages?'disabled':''}>›</button>
      </div></div></section>`;
  return html;
}
  function settingField(field,label,hint){
  return `<div class="field"><label>${label}</label>${numericInput(field,label)}<small>${hint}</small></div>`;
}
function configButtons(){
  return `<div class="savebar">
    <span class="note">${s.configDirty?'Есть несохранённые настройки':'Настройки сохранены'}</span>
    <div class="controls">
      <button class="btn" data-reset-config>Вернуть стандартные</button>
      <button class="btn primary" data-save-config>Сохранить настройки</button>
    </div></div>`;
}

/* ══ FIX 13: settings — три map со стрелками ══ */
function settings(){
  if(detailed())return filters()+card('Общие настройки','<p class="note">Настройки и доходы — общие для таблицы. Снимите фильтры для редактирования.</p>');
  const c=s.configDraft||cfg();
  let html=`<div class="tabs">${[['money','Доходы и план'],['ui','Интерфейс'],['rules','Правила']].map(([id,label])=>
    `<button data-tab="${id}" class="${s.tab===id?'active':''}">${label}</button>`).join('')}</div>`;
  if(s.tab==='money'){
    html+=`<p class="note">Выберите месяц вверху. Вручную доступны только два поля — ЕСП и план.</p>
    <div class="settings-grid">
      ${card('Доход ЕСП',settingField('esp','Доход ЕСП, ₽','Сумма за выбранный месяц.'))}
      ${card('План месяца',settingField('plan','План задач','Количество задач.'))}
    </div>
    <div class="savebar"><span data-save-status class="save-status">Сохранено</span>
    <button class="btn primary" data-save>Сохранить месяц</button></div>`;
  }else if(s.tab==='ui'){
    html+=`<div class="settings-grid">
      ${card('Оформление',[['animate','Плавные анимации'],['showCharts','Графики'],['showBanks','Карточки банков'],['showStatuses','Статусы на главной']].map(([k,v])=>
        `<label class="switchrow"><span>${v}</span><input class="switch" type="checkbox" data-config="${k}" ${c[k]?'checked':''}></label>`).join(''))}
      ${card('Таблица',`<div class="field"><label for="perPage">Строк на странице</label>
        <select id="perPage" data-config="perPage">${[10,25,50,100].map(v=>`<option ${c.perPage===v?'selected':''}>${v}</option>`).join('')}</select></div>`)}
    </div>${configButtons()}`;
  }else{
    const rules=[['done','Выполненные статусы'],['closed','Закрытые'],['invoice','Счета (исключить из выручки)'],['lp','Статусы LP'],['sp','Статусы СП']];
    html+=`<div class="settings-grid">
      ${card('Статусы',rules.map(([k,v])=>`<div class="field"><label>${v}</label><textarea data-rule="${k}">${h(c[k].join('\n'))}</textarea></div>`).join(''),'Одно правило — одна строка')}
      ${card('Банки',Piot.BANKS.map((b,i)=>`<div class="field"><label>${b.name}</label><textarea data-bankrule="${i}">${h(c.bankKeys[i].join('\n'))}</textarea></div>`).join('')+'<p class="note">Сопоставление по полям «Заказчик» и «Юр.лицо».</p>')}
    </div>${configButtons()}`;
  }
  return html;
}
function render(opt={}){
  if(!s.data)return;
  s.fx=opt.fx!==false;
  Object.keys(CHARTS).forEach(k=>delete CHARTS[k]);
  nav();
  $('#title').textContent=TITLES[s.page]||'Главная';
  document.body.classList.toggle('motion',fxOn());
  const pageMap={home,banks,finance,trend,plan:planPage,table:tablePage2,settings};
  $('#page').innerHTML=(pageMap[s.page]||home)();
  $('#page').setAttribute('aria-busy','false');
  $('#page').className='page-enter'+(s.fx&&fxOn()?' anim':'');
  saveStatus();
  const modeBadge=$('#modeBadge');
  if(modeBadge){
    if(s.data.demo){
      // Не показываем плашку «ДЕМО» в шапке.
      modeBadge.textContent='';
      modeBadge.hidden=true;
    }else{
      modeBadge.hidden=false;
      modeBadge.textContent='Google Sheets';
    }
  }
  $('#updated').textContent='Обновлено '+new Date(s.data.updated).toLocaleString('ru-RU');
  if(s.fx)playCounters();
  requestAnimationFrame(()=>{
    $$('.chart-line').forEach(p=>{try{p.style.setProperty('--len',p.getTotalLength().toFixed(0));}catch(e){}});
    $$('.donut-arc').forEach(a=>{a.setAttribute('stroke-dasharray',a.dataset.len+' '+a.dataset.rest);});
    $$('.ring-fg').forEach(r=>{r.setAttribute('stroke-dashoffset',r.dataset.ringoff);});
  });
}
const tip=$('#chartTip');
function hideTip(){tip.classList.remove('show');$$('.chart-svg.live').forEach(el=>el.classList.remove('live'));}

/* ══ FIX 14: tooltip — tip.innerHTML= ══ */
document.addEventListener('pointermove',e=>{
  const hit=e.target.closest&&e.target.closest('[data-hit]');
  if(!hit){hideTip();return;}
  const uid=hit.dataset.hit,i=+hit.dataset.i,m=CHARTS[uid];
  if(!m)return;
  const svg=document.getElementById(uid);
  if(svg){
    svg.classList.add('live');
    const cross=document.getElementById(uid+'-cross');
    if(cross){cross.setAttribute('x1',m.xs[i]);cross.setAttribute('x2',m.xs[i]);}
  }
  tip.innerHTML=`<div class="tip-h">${h(m.labels[i])}</div>`+m.series.map(sr=>
    `<div class="tip-r"><i style="background:${sr.color}"></i><span>${h(sr.name)}</span><b>${sr.money?rub(sr.values[i]||0):number(sr.values[i]||0)}</b></div>`).join('');
  tip.classList.add('show');
  const r=tip.getBoundingClientRect();
  let x=e.clientX+16,y=e.clientY-r.height/2;
  if(x+r.width>innerWidth-10)x=e.clientX-r.width-16;
  y=Math.max(10,Math.min(innerHeight-r.height-10,y));
  tip.style.left=x+'px';tip.style.top=y+'px';
},{passive:true});
document.addEventListener('scroll',hideTip,{passive:true});

/* ══ FIX 15: load — $('#page').innerHTML= ══ */
async function load(force=false){
  if(s.configDirty&&!confirm('Обновление сбросит несохранённые настройки. Продолжить?'))return;
  if(!force&&s.loaded)await flush();
  $('#reload').disabled=true;
  try{
    const d=await rpc('apiGetData');
    if(!d||!Array.isArray(d.records)||!d.ledger||!d.config||!Array.isArray(d.months))
      throw Error('Сервер вернул неполные данные');
    if(!s.loaded){
      const available=d.months.filter(Piot.validMonth).slice().sort();
      s.month=Piot.validMonth(d.currentMonth)?d.currentMonth:(available[available.length-1]||'');
    }
    s.data=d;s.configDraft=null;s.configDirty=false;s.loaded=true;
    if(force){s.draft={};s.invalid={};s.saveError='';}
    options();render();
  }catch(e){
    toast(e.message,true);
    if(!s.loaded)$('#page').innerHTML=`<section class="glass card"><h2>Не удалось загрузить данные</h2><p class="note">${h(e.message)}</p><button class="btn" data-retry>Повторить</button></section>`;
  }finally{$('#reload').disabled=false;}
}
async function navigate(page){await flush();s.page=page;s.tablePage=1;render();window.scrollTo({top:0,behavior:fxOn()?'smooth':'auto'});}
async function changeMonth(month){
  if(month&&!Piot.validMonth(month))return;
  try{await flush();s.month=month;s.tablePage=1;$('#month').value=month;render();}
  catch(e){$('#month').value=s.month;toast('Сначала сохраните или исправьте текущий ввод.',true);}
}
async function saveConfig(){
  try{
    const clean=Piot.validateConfig(s.configDraft||cfg());
    $('#page').setAttribute('aria-busy','true');
    const saved=await rpc('apiSaveConfig',{config:clean,revision:cfg().revision});
    s.data.config=saved;s.configDraft=null;s.configDirty=false;
    await load();toast('Настройки сохранены');
  }catch(e){toast(e.message,true);}
  finally{$('#page').setAttribute('aria-busy','false');}
}
function configInput(el){
  if(!s.configDraft)s.configDraft=JSON.parse(JSON.stringify(cfg()));
  const c=s.configDraft;
  if(el.dataset.config){const k=el.dataset.config;c[k]=el.type==='checkbox'?el.checked:Number(el.value);}
  if(el.dataset.rule)c[el.dataset.rule]=el.value.split('\n').map(x=>x.trim()).filter(Boolean);
  if(el.dataset.bankrule!=null)c.bankKeys[+el.dataset.bankrule]=el.value.split('\n').map(x=>x.trim()).filter(Boolean);
  s.configDirty=true;
}
async function click(e){
  const el=e.target.closest('button, .bank-card');if(!el)return;
  try{
    if(el.dataset.legend){
      const g=document.querySelectorAll('#'+el.dataset.legend+' [data-s="'+el.dataset.s+'"]');
      const off=el.classList.toggle('off');
      g.forEach(n=>n.classList.toggle('ser-off',off));
      return;
    }
    if(el.dataset.page)await navigate(el.dataset.page);
    else if(el.hasAttribute('data-open-table'))await navigate('table');
    else if(el.hasAttribute('data-save')){await flush();toast(s.data.demo?'Изменения сохранены только в текущем просмотре.':'Месяц сохранён в «Суммы»');}
    else if(el.hasAttribute('data-clear-filters')){await flush();Object.keys(s.filter).forEach(k=>s.filter[k]='');s.tablePage=1;render();}
    else if(el.dataset.gran){s.gran=el.dataset.gran;render({fx:false});}
    else if(el.dataset.bank){s.filter.bank=el.dataset.bank;await navigate('table');}
    else if(el.hasAttribute('data-task-status')){s.filter.task=s.filter.task===el.dataset.taskStatus?'':el.dataset.taskStatus;s.tablePage=1;render({fx:false});}
    else if(el.dataset.tab){await flush();s.tab=el.dataset.tab;render();}
    else if(el.dataset.sort){if(s.sort===el.dataset.sort)s.direction*=-1;else{s.sort=el.dataset.sort;s.direction=1;}s.tablePage=1;render({fx:false});}
    else if(el.dataset.pag){s.tablePage+=Number(el.dataset.pag);render({fx:false});}
    else if(el.hasAttribute('data-export')){
      const out=tableRows2().map(r=>Object.assign({},r,{source:r.source==='noesp'?'Без задачи ЕСП':'Заявка'}));
      const url=URL.createObjectURL(new Blob([Piot.csv(out,COLS)],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='piot-'+(s.month||'all')+'.csv';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Экспортировано: '+out.length+' строк');
    }
    else if(el.dataset.selectMonth)await changeMonth(el.dataset.selectMonth);
    else if(el.hasAttribute('data-save-config'))await saveConfig();
    else if(el.hasAttribute('data-reset-config')){
      if(confirm('Вернуть стандартные настройки? Доходы и планы останутся.')){s.configDraft=Piot.defaults();s.configDirty=true;render();}
    }
    else if(el.hasAttribute('data-close-dialog'))$('#conflict').close();
    else if(el.id==='resolveConflict'){$('#conflict').close();clearTimeout(s.timer);await load(true);}
    else if(el.id==='reload'||el.hasAttribute('data-retry'))await load();
    else if(el.id==='fullscreen'){
      if(!document.fullscreenElement){if(!document.documentElement.requestFullscreen)throw Error('Полный экран недоступен');await document.documentElement.requestFullscreen();}
      else await document.exitFullscreen();
    }
    else if(el.id==='prevMonth'||el.id==='nextMonth'){
      const list=s.data.months.filter(Piot.validMonth).slice().sort(),idx=list.indexOf(s.month);
      if(idx<0)await changeMonth(s.data.currentMonth);
      else{const n=idx+(el.id==='prevMonth'?-1:1);if(n>=0&&n<list.length)await changeMonth(list[n]);}
    }
  }catch(err){toast(err.message,true);}
}
document.addEventListener('click',click);
let searchTimer;
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.field){edit(el.dataset.field,el.value);el.setAttribute('aria-invalid',s.invalid[el.dataset.field]?'true':'false');}
  else if(el.dataset.filter==='q'){
    clearTimeout(searchTimer);s.filter.q=el.value;
    searchTimer=setTimeout(()=>{const p=el.selectionStart;render({fx:false});const inp=$('[data-filter=q]');if(inp){inp.focus();try{inp.setSelectionRange(p,p);}catch(err){}}},280);
  }
  else if(el.dataset.config||el.dataset.rule||el.dataset.bankrule!=null)configInput(el);
});
document.addEventListener('change',async e=>{
  const el=e.target;
  if(el.id==='month')await changeMonth(el.value);
  else if(el.dataset.filter){s.filter[el.dataset.filter]=el.value;s.tablePage=1;render({fx:false});}
  else if(el.id==='paidFilter'){s.paid=el.value;s.tablePage=1;render({fx:false});}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.dataset&&e.target.dataset.field){e.preventDefault();flush().catch(()=>{});}});
document.addEventListener('focusout',e=>{
  if(e.target.dataset&&e.target.dataset.field&&!Object.keys(s.draft).length&&!s.saving)
    setTimeout(()=>{if(!document.activeElement.matches('[data-field]'))render({fx:false});},0);
});
window.addEventListener('beforeunload',e=>{
  if(s.saving||Object.keys(s.draft).length||Object.keys(s.invalid).length||s.configDirty){e.preventDefault();e.returnValue='';}
});
nav();load();
})();
