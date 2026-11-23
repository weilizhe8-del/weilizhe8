'use strict';

let courseHelperConnected=false;
let sourceStatusTimer;
const courseCheck=$('sync');
function renderCourseSources(sites) {
  const container=$('sources');
  const opened=new Set([...container.querySelectorAll('details[open]')].map(el=>el.dataset.source));
  container.replaceChildren();
  for(const site of sites) {
    const group=node('div');
    const row=node('div',null,'source');
    row.append(node('span',site.name),node('small',(site.checked?new Date(site.checked).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+' · ':'')+site.status));
    group.append(row);
    const tasks=personalPlans.filter(t=>t.id.startsWith('import-') && t.source===site.name);
    if(tasks.length){
      const details=node('details');details.dataset.source=site.name;details.open=opened.has(site.name);
      details.append(node('summary','查看已导入事项（'+tasks.length+'）'));
      const items=node('ul');
      for(const task of tasks){
        const item=node('li');
        const when=task.date?[task.date,task.time].filter(Boolean).join(' '):'截止时间待确认';
        item.append(button(task.title,()=>showTask(task)),node('small',' · '+when+((task.brief||'').includes('倒计时估算')?'（估算）':'')+(done.has(task.id)?' · 已完成':'')));
        items.append(item);
      }
      details.append(items);group.append(details);
    }
    container.append(group);
  }
}
courseCheck.onclick=()=>{
  if (!courseHelperConnected) {
    syncInfo('请在登录课程平台的 Edge 或 Chrome 安装采集助手 1.2.1。');
    courseCheck.closest('section').querySelector('details').open=true;
    document.dispatchEvent(new Event('desk-course-query'));
    return;
  }
  clearTimeout(sourceStatusTimer);sourceStatusTimer=null;
  syncInfo('正在检查课程平台…');
  document.dispatchEvent(new Event('desk-course-check'));
};

document.addEventListener('desk-course-results',e=>{
  try {
    const {sites,records}=JSON.parse(e.detail);
    if(!Array.isArray(sites)||!Array.isArray(records))return;
    courseHelperConnected=true;
    renderCourseSources(sites);
    if(!sites.length){syncInfo('助手已连接，正在等候平台列表。若扩展仍显示「订阅当前作业列表」，请更新至 1.2.1。');return;}
    if(!records.length){if(!sourceStatusTimer)syncInfo('已连接 '+sites.length+' 个列表。');return;}
    if(document.querySelector('dialog[open]')){syncInfo('已有采集结果，关闭编辑窗口后导入。');return;}
    const data=personalData(),plans=new Map(data.plans.map(p=>[p.id,p])),completedIds=new Set(data.done),ack=[];
    let added=0,updated=0;
    for(const {plan,version,completed} of records){
      if(!/^import-[0-9a-f]{64}$/.test(plan?.id)||!/^\w{64}$/.test(version) ||
        !['deadline','quiz'].includes(plan.type)||typeof plan.source!=='string'||typeof plan.title!=='string'||
        (plan.date!==null&&!validDate(plan.date))||typeof plan.time!=='string'||(plan.time&&(!plan.date||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plan.time))))throw Error('采集结果格式无效。');
      const old=plans.get(plan.id);
      ack.push([plan.id,version]);
      if(completed===true) {
        if(old&&!completedIds.has(plan.id)){completedIds.add(plan.id);updated++;}
        continue;
      }
      const next={...(old||{courses:[],project:'',brief:plan.brief||''}),id:plan.id,title:plan.title,type:plan.type,
        date:plan.date??old?.date??null,time:plan.date?plan.time:old?.time||'',source:plan.source,brief:plan.brief||''};
      if(!old)added++;
      else if(['title','type','date','time','source','brief'].some(k=>next[k]!==old[k]))updated++;
      plans.set(next.id,next);
    }
    if(added||updated){
      installPersonalData(validateBackupData({...data,plans:[...plans.values()],done:[...completedIds]}));
      render();
      renderCourseSources(sites);
    }
    clearTimeout(sourceStatusTimer);
    sourceStatusTimer=setTimeout(()=>{sourceStatusTimer=null;},60000);
    syncInfo('已接收作业：新增 '+added+' 项，更新 '+updated+' 项。');
    document.dispatchEvent(new CustomEvent('desk-course-saved',{detail:JSON.stringify(ack)}));
  } catch(error){syncInfo('作业未确认导入，助手会保留结果并重试。'+error.message);}
});
document.addEventListener('close',()=>document.dispatchEvent(new Event('desk-course-query')),true);
document.dispatchEvent(new Event('desk-course-query'));
