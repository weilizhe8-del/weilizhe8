'use strict';

const backupFormat='student-desk-backup';
const mapFields=['notes','links','requirements','projectNotes'];
let restoreCandidate=null;
let undoing=false;

function checkBackup(condition, message) {
  if (!condition) throw new Error(message);
}
function validDate(value) {
  if (typeof value!=='string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const date=calendarDate(value);
  return Number.isFinite(+date) && dateKey(date)===value;
}
function validateBackupData(data) {
  checkBackup(data && typeof data.synced==='boolean' && ['plans','done',...mapFields].every(k=>Array.isArray(data[k])), '备份缺少完整的工作台数据。');
  const ids=new Set(scheduleExamples.map(t=>t.id));
  const validTime=value=>typeof value==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const changes={};
  const savedSites=[];
  let savedPlatforms;
  if(data.homePlatforms!==undefined) {
    checkBackup(Array.isArray(data.homePlatforms),'首页常用平台列表无效。');
    savedPlatforms=data.homePlatforms.map(url=>typeof url==='string' && httpUrl(url));
    checkBackup(savedPlatforms.every(Boolean) && new Set(savedPlatforms).size===savedPlatforms.length,'首页常用平台的网址无效或重复。');
  }
  if(data.bookmarks!==undefined) {
    checkBackup(Array.isArray(data.bookmarks),'收藏网站列表无效。');
    const urls=new Set();
    for(const site of data.bookmarks) {
      const url=typeof site?.url==='string' && httpUrl(site.url);
      checkBackup(url && !urls.has(url) && typeof site.name==='string' && site.name.trim() && site.name.length<=100 &&
        typeof site.category==='string' && site.category.trim() && site.category.length<=60,'收藏网站的名称、网址或分类无效，或网址重复。');
      urls.add(url);
      savedSites.push({name:site.name.trim(),url,category:site.category.trim()});
    }
  }
  if(data.timeChanges!==undefined) {
    checkBackup(data.timeChanges && typeof data.timeChanges==='object' && !Array.isArray(data.timeChanges),'时段调整格式无效。');
    for(const [id,slot] of Object.entries(data.timeChanges)) {
      checkBackup(scheduleExamples.some(t=>t.id===id && ['attendance','plan'].includes(t.type)) &&
        slot && validDate(slot.date) && validTime(slot.time) && validTime(slot.endTime) && slot.time<slot.endTime,'时段调整内容无效。');
      changes[id]={date:slot.date,time:slot.time,endTime:slot.endTime};
    }
  }
  for (const t of data.plans) {
    checkBackup(t && typeof t.id==='string' && /^[\w-]+$/.test(t.id) && !ids.has(t.id), '安排编号缺失或重复。');
    checkBackup(typeof t.title==='string' && t.title.trim() && Object.hasOwn(kind,t.type), '安排标题或类型无效。');
    checkBackup((t.date===null || validDate(t.date)) && (!t.time || (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time) && t.date)), '安排日期或时刻无效。');
    checkBackup(Array.isArray(t.courses) && t.courses.every(c=>courseByNumber.has(c)) && (!t.project || projectsById.has(t.project)), '备份中的课程或项目无法识别。');
    checkBackup(['time','source','brief','project'].every(k=>t[k]===undefined || typeof t[k]==='string'), '安排字段格式无效。');
    if(t.endTime!==undefined) checkBackup(['plan','attendance'].includes(t.type) && validTime(t.time) && validTime(t.endTime) && t.time<t.endTime,'结束时刻无效。');
    if (t.studyFor!==undefined) {
      checkBackup(t.type==='plan' && typeof t.studyFor==='string' && /^[\w-]+$/.test(t.studyFor) && t.studyFor!==t.id &&
        typeof t.endTime==='string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.endTime) &&
        t.date && t.time && t.time<t.endTime,'学习时段格式无效。');
    }
    // Import only user-editable fields; the renderer also consumes fields for built-in examples.
    ids.add(t.id);
  }
  checkBackup(data.done.every(id=>ids.has(id)) && new Set(data.done).size===data.done.length,'完成记录编号无效。');
  for (const field of mapFields) {
    const seen=new Set();
    for (const entry of data[field]) {
      checkBackup(Array.isArray(entry) && entry.length===2, '笔记或链接格式无效。');
      const [id,value]=entry;
      checkBackup((field==='projectNotes'?projectsById:ids).has(id) && !seen.has(id) && typeof value==='string','笔记或链接的归属无效。');
      if (field==='links' || field==='requirements') checkBackup(httpUrl(value),'备份含有无效链接。');
      seen.add(id);
    }
  }
  const plans=data.plans.map(t=>({id:t.id,title:t.title,type:t.type,date:t.date,time:t.time || '',courses:t.courses,
    project:t.project || '',source:t.source || '',brief:t.brief || '',
    ...(t.studyFor ? {studyFor:t.studyFor} : {}),...(t.endTime ? {endTime:t.endTime} : {})}));
  return {plans,done:data.done,notes:data.notes,links:data.links,requirements:data.requirements,projectNotes:data.projectNotes,synced:data.synced,
    ...(Object.keys(changes).length?{timeChanges:changes}:{}),...(savedSites.length?{bookmarks:savedSites}:{}),
    ...(savedPlatforms!==undefined?{homePlatforms:savedPlatforms}:{})};
}
function summary(data) {
  return data.plans.length+' 条个人安排、'+data.done.length+' 条完成记录、'+
    (data.notes.length+data.projectNotes.length)+' 条笔记、'+(data.links.length+data.requirements.length)+' 个作业链接、'+(data.bookmarks?.length || 0)+' 个收藏网站';
}
function restorePreview(data, undo) {
  restoreCandidate=data;
  undoing=undo;
  $('restore-title').textContent=undo?'撤销上次恢复':'恢复备份';
  $('backup-description').textContent=undo?'将回到上次恢复前的状态。恢复之后新增或修改的内容也会被替换。':'确认后将替换此浏览器里的工作台数据，并保留一份可撤销的恢复前快照。';
  $('backup-count').textContent='即将载入：'+summary(data)+'。当前：'+summary(personalData())+'。';
  $('confirm-restore').textContent=undo?'确认撤销':'确认恢复';
  $('restore-error').textContent='';
  $('restore-dialog').showModal();
}
$('export-data').onclick=()=>{
  const backup={format:backupFormat,version:1,exportedAt:new Date().toISOString(),data:personalData()};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const download=node('a'); download.href=url; download.download='课间-工作台-'+todayKey()+'.json';
  document.body.append(download); download.click(); download.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('backup-status').textContent='已生成备份：'+summary(backup.data)+'。';
};
$('import-data').onclick=()=>$('backup-file').click();
$('backup-file').onchange=async e=>{
  const file=e.target.files[0];
  e.target.value='';
  if (!file) return;
  try {
    let backup;
    try { backup=JSON.parse((await file.text()).replace(/^\uFEFF/,'')); }
    catch { throw new Error('文件无法读取为 JSON。'); }
    checkBackup(backup?.format===backupFormat && backup.version===1,'请选择本工作台导出的 JSON 备份。');
    restorePreview(validateBackupData(backup.data),false);
    $('backup-status').textContent='';
  } catch(error) { $('backup-status').textContent=error.message; }
};
$('undo-import').hidden=!recoverySnapshot;
$('undo-import').onclick=()=>{
  try { restorePreview(validateBackupData(recoverySnapshot),true); }
  catch(error) { $('backup-status').textContent=error.message; }
};
$('confirm-restore').onclick=()=>{
  if (!restoreCandidate) return;
  try {
    // Detach the snapshot from live arrays before replacing their contents.
    const previous=undoing?null:JSON.parse(JSON.stringify(personalData()));
    installPersonalData(restoreCandidate,previous);
  } catch(error) {
    $('restore-error').textContent='恢复未写入，本机数据仍保留。'+(error.name==='QuotaExceededError'?'可用存储不足。':error.message);
    return;
  }
  $('restore-dialog').close();
  $('undo-import').hidden=!recoverySnapshot;
  $('backup-status').textContent=undoing?'已撤销上次恢复。':'备份已恢复。';
  showingDone=false; syncInfo(); render();
};
$('restore-dialog').addEventListener('close',()=>{restoreCandidate=null;});
window.addEventListener('storage',e=>{
  if ((e.key===storageKey || e.key===null) && !document.querySelector('dialog[open]')) location.reload();
});
