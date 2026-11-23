import { readList } from './extract.js';

const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
let storageQueue=Promise.resolve();
function update(fn) {
  const job=storageQueue.then(async()=>{
    const state=await chrome.storage.local.get({sites:[],pending:{}});
    const result=await fn(state);
    await chrome.storage.local.set(state);
    return result;
  });
  storageQueue=job.catch(()=>{});
  return job;
}
async function scan(site, existingTab) {
  let created, result;
  try {
    if (!existingTab) created=await chrome.tabs.create({url:site.url,active:false});
    const tabId=existingTab ?? created.id;
    for(let attempt=0;attempt<(existingTab?1:12);attempt++){
      if (!existingTab) await wait(1000);
      try {
        const [frame]=await chrome.scripting.executeScript({target:{tabId},func:readList,args:[site.url]});
        result=frame.result;
        if (result?.rows?.length || existingTab) break;
      } catch { result={error:'无法读取列表，请确认平台登录、站点权限和校园网连接。'}; }
    }
  } finally { if(created) await chrome.tabs.remove(created.id).catch(()=>{}); }
  if(!result || result.error) throw Error(result?.error || '未能读取列表。');
  const records=new Map();
  for(const row of result.rows) {
    const id='import-'+await digest(JSON.stringify([site.key,row.course,row.title]));
    if(records.has(id)) throw Error('列表中存在同名作业，暂缓导入以免合并错项。');
    const plan={id,title:row.title,type:row.type,date:row.date,time:row.time,source:site.name,brief:row.course,project:'',courses:[]};
    records.set(id,{plan,version:await digest(JSON.stringify(plan))});
  }
  return {records,status:'读取 '+records.size+' 项'+(result.incomplete?'，另有 '+result.incomplete+' 项未能识别截止时间':'')};
}
async function check(site,tabId) {
  try {
    const {records,status}=await scan(site,tabId);
    await update(state=>{
      const current=state.sites.find(s=>s.key===site.key);if(!current)return;
      current.status=status;current.checked=Date.now();
      for(const [id,record] of records) {
        if(current.versions[id]!==record.version)state.pending[id]={...record,key:site.key};
        current.versions[id]=record.version;
      }
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
    for(const site of sites) await check(site);
  })().finally(()=>{checking=null;});
  return checking;
}
async function alarm() {
  if(!await chrome.alarms.get('course-lists')) await chrome.alarms.create('course-lists',{periodInMinutes:60});
}
chrome.runtime.onInstalled.addListener(alarm);
chrome.runtime.onStartup.addListener(alarm);
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='course-lists')return checkAll();});

async function handle(msg,sender) {
  const popup=sender.url===chrome.runtime.getURL('popup.html');
  const desk=sender.tab && new URL(sender.url).origin==='https://weilizhe8.com' && sender.frameId===0;
  if(popup && msg.action==='subscribe') {
    const url=new URL(msg.url);
    if(!['https:','http:'].includes(url.protocol) || url.username || url.password ||
        /(?:access_token|id_token|sessionid|ticket|password|authorization)=/i.test(url.href))throw Error('请从登录后的普通作业列表订阅。');
    const site={key:await digest(url.href),url:url.href,name:msg.name,versions:{}};
    // Only persist a page that actually contains a recognizable list.
    const {records,status}=await scan(site,msg.tabId);
    await update(state=>{
      const previous=state.sites.find(s=>s.key===site.key);
      if(!previous)state.sites.push(site);
      const current=previous||site;current.name=site.name;current.status=status;current.checked=Date.now();
      for(const [id,record] of records){
        if(current.versions[id]!==record.version)state.pending[id]={...record,key:site.key};
        current.versions[id]=record.version;
      }
    });
    await alarm();return {message:status};
  }
  if(popup && msg.action==='remove') {
    return update(s=>{s.sites=s.sites.filter(x=>x.key!==msg.key);for(const [id,row] of Object.entries(s.pending))if(row.key===msg.key)delete s.pending[id];});
  }
  if(!desk) return;
  if(msg.action==='check')await checkAll();
  if(msg.action==='ack')await update(s=>{for(const [id,version] of msg.entries)if(s.pending[id]?.version===version)delete s.pending[id];});
  const {sites,pending}=await chrome.storage.local.get({sites:[],pending:{}});
  return {sites:sites.map(({name,status,checked})=>({name,status,checked})),records:Object.values(pending).map(({plan,version})=>({plan,version}))};
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  handle(msg,sender).then(x=>respond(x??{}),e=>respond({message:e.message}));return true;
});
