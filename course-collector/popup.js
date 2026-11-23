const $ = id=>document.getElementById(id);
const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
let url;
try { url = new URL(tab.url); } catch {}
const allowed = url && ['http:','https:'].includes(url.protocol) && !url.username && !url.password && url.hostname!=='weilizhe8.com';
if (allowed) {
  $('add').disabled=false;
  $('name').value = /(^|\.)zhihuishu\.com$/.test(url.hostname)?'智慧树':url.hostname;
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
  const granted=await chrome.permissions.request({origins:[url.protocol+'//'+url.hostname+'/*']});
  if (!granted) { $('status').textContent='需要此课程站点的读取权限。';return; }
  $('add').disabled=true;
  try {
    const result=await chrome.runtime.sendMessage({action:'subscribe',url:url.href,tabId:tab.id,name});
    $('status').textContent=result.message;
  } catch { $('status').textContent='采集未完成，请重新打开列表再试。'; }
  finally { $('add').disabled=false;await showSites(); }
};
await showSites();
