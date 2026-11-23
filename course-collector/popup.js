import { platformFor } from './platforms.js';
const $ = id=>document.getElementById(id);
const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
let url;
try { url = new URL(tab.url); } catch {}
const allowed = url && ['http:','https:'].includes(url.protocol) && !url.username && !url.password && url.hostname!=='weilizhe8.com';
const origins = new Set();
if (allowed) {
  origins.add(url.protocol+'//'+url.hostname+'/*');
  const platform=platformFor(url.href);
  $('name').value=platform==='polymas'?'AI 教学中心 · 待办任务':
    platform==='work'?'学习通 · 作业':platform==='exam'?'学习通 · 考试':
    /(^|\.)zhihuishu\.com$/.test(url.hostname)?'智慧树':url.hostname;
  if(platform==='work' || platform==='exam') {
    $('status').textContent='可把来源名改成课程名，例如「离散数学 · 作业」。';
    try {
      const [frame]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>[...document.querySelectorAll('iframe[src]')]
        .filter(el=>el.getClientRects().length && el.clientWidth && el.clientHeight)
        .map(el=>new URL(el.src)).filter(u=>u.protocol==='https:' && /(?:^|\.)chaoxing\.com$/.test(u.hostname)).map(u=>u.origin)});
      for(const origin of frame.result)origins.add(origin+'/*');
    } catch { /* The top-level page can still be subscribed. */ }
  }
  $('add').disabled=false;
}
async function showSites() {
  const {sites=[]}=await chrome.storage.local.get('sites');
  $('sites').replaceChildren();
  for(const site of sites) {
    const row=document.createElement('p'), remove=document.createElement('button');
    remove.textContent='取消订阅';
    remove.onclick=async()=>{await chrome.runtime.sendMessage({action:'remove',key:site.key});await showSites();};
    row.append(site.name+' · '+(site.status||'等待检查')+' ',remove);$('sites').append(row);
  }
}
$('add').onclick=async()=>{
  const name=$('name').value.trim();
  if (!name) { $('status').textContent='请输入来源名。';return; }
  const granted=await chrome.permissions.request({origins:[...origins]});
  if (!granted) { $('status').textContent='需要此课程站点的读取权限。';return; }
  $('add').disabled=true;
  try {
    const result=await chrome.runtime.sendMessage({action:'subscribe',url:url.href,tabId:tab.id,name});
    $('status').textContent=result.message;
  } catch { $('status').textContent='采集未完成，请重新打开列表再试。'; }
  finally { $('add').disabled=false;await showSites(); }
};
await showSites();
