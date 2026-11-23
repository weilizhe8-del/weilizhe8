// DOM events carry assignment metadata only between the isolated extension and its desk.
async function deliver(action,entries) {
  try {
    const data=await chrome.runtime.sendMessage({action,entries});
    if(data?.sites) document.dispatchEvent(new CustomEvent('desk-course-results',{detail:JSON.stringify(data)}));
  } catch { /* The next page visit reconnects after an extension update. */ }
}
document.addEventListener('desk-course-query',()=>deliver('read'));
document.addEventListener('desk-course-check',()=>deliver('check'));
document.addEventListener('desk-course-saved',e=>{
  try { const entries=JSON.parse(e.detail);if(Array.isArray(entries)&&entries.length)deliver('ack',entries); }catch{}
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)deliver('read');});
setInterval(()=>{if(!document.hidden)deliver('read');},20000);
deliver('read');
