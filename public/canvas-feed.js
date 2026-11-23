'use strict';

(() => {
  const panel=$('canvas-feed'), input=$('canvas-url'), status=$('canvas-state');
  let previewed='', busy=false;
  function clearPreview(){
    previewed='';$('canvas-preview').hidden=true;$('canvas-sample').replaceChildren();
  }
  function showState(result){
    $('canvas-actions').hidden=!result.bound;
    $('canvas-form').hidden=result.bound;
    status.textContent=result.bound?
      '已绑定 · '+new Date(result.checked).toLocaleString('zh-CN')+' 检查，读到 '+result.total+' 条。'+
      (result.skipped?'另有 '+result.skipped+' 条暂未支持。':'')+(result.message||''):
      '未绑定。请从 Canvas「日历 → 日历馈送」复制地址。';
  }
  async function run(action) {
    if(busy)return;
    busy=true;
    const value=input.value.trim();
    for(const control of panel.querySelectorAll('button,input'))control.disabled=true;
    try{
      if(action==='preview')clearPreview();
      if(action)status.textContent=action==='preview'?'正在读取 Canvas 日历…':'正在更新订阅…';
      const response=await fetch('/api/desk/v1/canvas',{
        method:action?'POST':'GET',credentials:'same-origin',redirect:'manual',cache:'no-store',
        signal:AbortSignal.timeout(25000),
        ...(action?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action,
          ...(action==='preview'?{url:value}:action==='bind'?{url:previewed}:{})})}:{})
      });
      if(response.type==='opaqueredirect'||[401,403].includes(response.status))throw Error('请刷新工作台并重新登录。');
      const result=await response.json();
      if(!response.ok || result.error)throw Error(result.error||'订阅服务暂不可用。');
      if(action==='preview'){
        previewed=value;
        status.textContent='预览就绪。';
        $('canvas-count').textContent='读到 '+result.total+' 条安排'+(result.skipped?'，另有 '+result.skipped+' 条暂未支持':'')+'。';
        $('canvas-sample').replaceChildren(...result.sample.map(t=>node('li',t.date+' '+t.time+' '+t.title)));
        $('canvas-preview').hidden=false;
      }else{
        showState(result);
        if(action){input.value='';clearPreview();}
        if(action==='bind'||action==='refresh')$('cloud-retry').click();
      }
    }catch(e){status.textContent=e instanceof SyntaxError || e instanceof TypeError || e.name==='TimeoutError'?'请求未完成，请稍后重试。':e.message;}
    finally{for(const control of panel.querySelectorAll('button,input'))control.disabled=false;busy=false;}
  }
  input.addEventListener('input',clearPreview);
  $('canvas-form').onsubmit=e=>{e.preventDefault();run('preview');};
  $('canvas-bind').onclick=()=>{if(previewed)run('bind');};
  $('canvas-refresh').onclick=()=>run('refresh');
  $('canvas-unbind').onclick=()=>{if(confirm('停止自动更新并移除馈送地址？已导入的安排会保留。'))run('disconnect');};
  const load=()=>{if(location.hash==='#inbox'&&!previewed)run();};
  window.addEventListener('hashchange',load);load();
})();
