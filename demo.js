(function(){
  var PARTNERS=['LIFE PAY','Авт Биз'];
  var TASKS=['Клиент сам установил','Клиент настроен с нашей помощью','Задача выполнена: клиент оплатил LP','В работе у СП','Задача выполнена: клиент оплатил СП','Новая'];
  var CUSTOMERS=['ВТБ · Отдел МСБ','Альфа-Банк · Корп','Точка · ООО Ромашка','ПСБ · ИП Петров','Альфа-Банк · ООО Звезда','ВТБ · Розница','Точка · ООО Гармония'];
  var LEGAL=['ВТБ','Альфа-Банк','Точка','ПСБ','Альфа-Банк','ВТБ','Точка'];
  var AMOUNTS=[0,15000,22000,35000,0,48000,12500,27000,0,55000,18000,30000,0,42000];
  function rnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
  function pick(a){return a[rnd(0,a.length-1)];}
  var records=[],months=[],now=new Date();
  for(var mi=5;mi>=0;mi--){
    var y=now.getFullYear(),m=now.getMonth()-mi;
    while(m<0){m+=12;y--;}
    var key=y+'-'+String(m+1).padStart(2,'0');months.push(key);
    for(var i=0,cnt=rnd(28,55);i<cnt;i++){
      var ci=rnd(0,CUSTOMERS.length-1),amt=pick(AMOUNTS),d=rnd(1,28),ds=Math.min(28,d+rnd(0,5)),task=pick(TASKS);
      var done=task.indexOf('выполнена')!==-1||task.indexOf('настроен')!==-1||task.indexOf('сам установил')!==-1;
      records.push({numero:String(1000+records.length+1),partner:pick(PARTNERS),
        client:'Клиент '+String.fromCharCode(1040+rnd(0,15))+'.'+String.fromCharCode(1040+rnd(0,15))+'.',
        status:done?'Выполнена':pick(['В работе','Новая заявка']),taskStatus:task,amount:amt,
        responsible:pick(['Иванов','Петрова','Сидоров','Кузнецова']),priority:pick(['Высокий','Средний','Низкий']),
        date:key+'-'+String(d).padStart(2,'0'),dateStatus:key+'-'+String(ds).padStart(2,'0'),
        sla:done?'Выполнен в срок':rnd(0,3)===0?'🔴 Просрочен':'В норме',
        customer:CUSTOMERS[ci],legalEntity:LEGAL[ci],source:'main'});
    }
    for(var j=0;j<rnd(3,8);j++)records.push({numero:'ESP-'+(records.length+1),partner:'LIFE PAY',client:'Без задачи ЕСП',status:'',taskStatus:'',amount:pick([12000,18000,24000,35000,45000]),responsible:'',priority:'',date:key+'-'+String(rnd(1,28)).padStart(2,'0'),dateStatus:'',sla:'',customer:'',legalEntity:'',source:'noesp'});
  }
  var ledger={};
  var config=Piot.defaults();
  months.forEach(function(m,i){ledger[m]={plan:50+i*2,done:null,closed:null,sp:null,esp:rnd(80000,250000),revision:0,updated:'',auto:{total:0,done:0,closed:0,revenue:0,sp:0},autoUpdated:''};});
  window.PIOT_DEMO={call:function(name,arg){return new Promise(function(res){setTimeout(function(){
    if(name==='apiGetData')res({records:records,ledger:ledger,config:config,months:months,currentMonth:months[months.length-1],updated:new Date().toISOString(),demo:true});
    else if(name==='apiSaveMonth'){var m=ledger[arg.month]||Piot.emptyMonth();Object.assign(m,arg.patch);m.revision=(m.revision||0)+1;ledger[arg.month]=m;res({value:m});}
    else if(name==='apiSaveConfig'){config=Object.assign({},arg.config,{revision:(config.revision||0)+1});res(config);}
    else res('ok');},180);});}};
})();
