import { readList } from './extract.js';
import { platformFor, readPlatform, subscriptionAddress } from './platforms.js';
import { automaticLists, readSummary } from './automatic.js';

const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
let storageQueue=Promise.resolve();
function update(fn) {
  const job=storageQueue.then(async()=>{
    const state=await chrome.storage.local.get({sites:[],pending:{},autoEnabled:true});
    const result=await fn(state);
    await chrome.storage.local.set(state);
    return result;
  });
  storageQueue=job.catch(()=>{});
  return job;
}
async function scan(site, existingTab) {
  let created, result;
  const summary = automaticLists.find(s=>s.url===site.url && s.kind!=='polymas');
  const platform = platformFor(site.url);
  try {
    if (!existingTab) created=await chrome.tabs.create({url:site.url,active:false});
    const tabId=existingTab ?? created.id;
    for(let attempt=0;attempt<(existingTab?1:12);attempt++){
      if (!existingTab) await wait(1000);
      try {
        const [frame]=await chrome.scripting.executeScript({target:{tabId},func:summary?readSummary:platform?readPlatform:readList,args:summary?[summary.kind,site.url]:platform?[platform,site.url]:[site.url]});
        result=frame.result;
        if (result?.external?.length) {
          const frames=await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:readPlatform,args:[platform,site.url,result.external]});
          const lists=frames.filter(f=>f.frameId!==0 && f.result?.ready);
          if(lists.length===1)result=lists[0].result;
          else if(!lists.length) result={error:'学习通课程内的列表未加载或未获授权，请在该栏目重新订阅。'};
        }
        if (result?.ready || result?.rows?.length || existingTab) break;
      } catch { result={error:'请在这个浏览器登录'+(summary?'学习通':platform==='polymas'?'AI 教学中心':'课程平台')+'，并确认扩展有权读取该站点。'}; }
    }
  } finally { if(created) await chrome.tabs.remove(created.id).catch(()=>{}); }
  if(!result || result.error) throw Error(result?.error || '未能读取列表。');
  // A long-open tab may display an old countdown. Reopen the subscribed list to sample it.
  if(existingTab && result.countdown) return scan(site);
  const records=new Map();
  let completed=0;
  for(const row of result.rows) {
    let key=site.key,course=row.course;
    if(summary && row.courseId && row.classId) {
      const params=new URLSearchParams({courseid:row.courseId,clazzid:row.classId,pageHeader:summary.kind==='work'?'8':'9'});
      key=await digest('https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu?'+params);
      course=''; // Match the ID used by earlier per-course subscriptions.
    }
    const id='import-'+await digest(JSON.stringify([key,course,row.taskId && key===site.key?row.taskId:row.title]));
    if(records.has(id)) throw Error('列表中存在同名作业，暂缓导入以免合并错项。');
    const brief=[row.course,row.estimated?'截止时间按平台倒计时估算（北京时间）。':(!row.completed && !row.date?'平台未显示明确截止时间。':'')].filter(Boolean).join(' · ');
    const plan={id,title:row.title,type:row.type,date:row.date,time:row.time,source:site.name,brief,project:'',courses:[]};
    let estimate;
    if(row.estimated){
      estimate=plan.date+'T'+plan.time;
      const previous=site.estimates?.[id];
      if(previous && Math.abs(Date.parse(previous+'Z')-Date.parse(estimate+'Z'))<=60000){
        estimate=previous; [plan.date,plan.time]=estimate.split('T');
      }
    }
    if(row.completed)completed++;
    const data=row.completed?{plan,completed:true}:{plan};
    records.set(id,{...data,estimate,version:await digest(JSON.stringify(row.completed?data:plan))});
  }
  return {records,status:'读取 '+(records.size-completed)+' 项'+(completed?'，已完成 '+completed+' 项':'')+(result.skipped?'，已截止 '+result.skipped+' 项':'')+(result.incomplete?'，'+result.incomplete+' 项截止时间待确认':'')};
}
function saveScan(state,site,records,status) {
  site.status=status;site.checked=Date.now();site.estimates??={};
  for(const [id,record] of records) {
    if(site.versions[id]!==record.version)state.pending[id]={...record,key:site.key};
    site.versions[id]=record.version;
    if(record.estimate) site.estimates[id]=record.estimate;
    else delete site.estimates[id];
  }
}
async function check(site,tabId) {
  try {
    const {records,status}=await scan(site,tabId);
    await update(state=>{
      const current=state.sites.find(s=>s.key===site.key);if(!current)return;
      saveScan(state,current,records,status);
    });
    return status;
  } catch(error) {
    await update(state=>{const current=state.sites.find(s=>s.key===site.key);if(current){current.status=error.message;current.checked=Date.now();}});
    return error.message;
  }
}
let checking;
function checkAll() {
  if(!checking) checking=(async()=>{
    const {sites=[]}=await chrome.storage.local.get('sites');
    for(const site of sites) {
      if(site.automatic && (await chrome.storage.local.get('autoEnabled')).autoEnabled===false)continue;
      await check(site);
    }
  })().finally(()=>{checking=null;});
  return checking;
}
async function alarm() {
  if(!await chrome.alarms.get('course-lists')) await chrome.alarms.create('course-lists',{periodInMinutes:60});
}
async function initialize() {
  await update(async state=>{
    for(const {url,name} of automaticLists) {
      const current=state.sites.find(s=>subscriptionAddress(s.url)===url);
      if(current){current.automatic=true;current.url=url;}
      else state.sites.push({key:await digest(url),url,name,automatic:true,versions:{},status:'等待首次检查'});
    }
  });
  await alarm();
  await checkAll();
}
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='course-lists')return checkAll();});

async function handle(msg,sender) {
  const popup=sender.url===chrome.runtime.getURL('popup.html');
  const desk=sender.tab && new URL(sender.url).origin==='https://weilizhe8.com' && sender.frameId===0;
  if(popup && msg.action==='automatic') {
    await update(state=>{state.autoEnabled=msg.enabled===true;});
    if(msg.enabled)await checkAll();
    return {};
  }
  if(popup && msg.action==='check'){await checkAll();return {};}
  if(popup && msg.action==='subscribe') {
    const url=new URL(msg.url);
    if(!['https:','http:'].includes(url.protocol) || url.username || url.password ||
        /(?:access_token|id_token|sessionid|ticket|password|authorization)=/i.test(url.href))throw Error('请从登录后的普通作业列表订阅。');
    const address=subscriptionAddress(url.href);
    const {sites=[]}=await chrome.storage.local.get('sites');
    const previous=sites.find(s=>subscriptionAddress(s.url)===address);
    const site={versions:{},...previous,key:previous?.key??await digest(address),url:url.href,name:msg.name};
    // Only persist a page that actually contains a recognizable list.
    const {records,status}=await scan(site,msg.tabId);
    await update(state=>{
      const previous=state.sites.find(s=>s.key===site.key);
      if(!previous)state.sites.push(site);
      const current=previous||site;current.name=site.name;current.url=site.url;
      saveScan(state,current,records,status);
    });
    await alarm();return {message:status};
  }
  if(popup && msg.action==='remove') {
    return update(s=>{s.sites=s.sites.filter(x=>x.key!==msg.key);for(const [id,row] of Object.entries(s.pending))if(row.key===msg.key)delete s.pending[id];});
  }
  if(!desk) return;
  if(msg.action==='check')await checkAll();
  if(msg.action==='ack')await update(s=>{for(const [id,version] of msg.entries)if(s.pending[id]?.version===version)delete s.pending[id];});
  const {sites,pending,autoEnabled}=await chrome.storage.local.get({sites:[],pending:{},autoEnabled:true});
  return {sites:sites.map(({name,status,checked,automatic})=>({name,status:automatic&&!autoEnabled?'已暂停':status,checked})),records:Object.values(pending).map(({plan,version,completed})=>({plan,version,completed}))};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  handle(msg,sender).then(x=>respond(x??{}),e=>respond({message:e.message}));return true;
});
