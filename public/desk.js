'use strict';

// Load order (index.html, all deferred): catalog.js → schedule-data.js → desk.js → planner.js.
// desk.js owns state, storage, shared helpers, the inbox and the task dialog.
// planner.js owns the month calendar and the project library, and performs the first render.

const $ = id => document.getElementById(id);
const projectsById = new Map(projectCatalog.map(p => [p.id, p]));
const courseByNumber = new Map(catalog.courses.map(c => [Number(c.id.slice(-2)), c]));
const oldTools = [
  {name:'LaTeX 工具', url:'https://weilizhe8.com/latex-tool/', category:'旧站课程工具'},
  {name:'进制转换', url:'https://weilizhe8.com/jin-zhi-converter/', category:'旧站课程工具'},
  {name:'测试脚本生成器', url:'https://weilizhe8.com/script-builder/', category:'旧站课程工具'}
];
const tools = [...catalog.tools, ...oldTools];
const kind = {deadline:'交付', attendance:'参加', quiz:'测验', plan:'计划'};
const storageKey = 'student-desk:preview:v1';
let state;
let lastStored=null;
try { lastStored=localStorage.getItem(storageKey); state=JSON.parse(lastStored) || {}; } catch { state = {}; }
const done = new Set(state.done || []);
const notes = new Map(state.notes || []);
const taskLinks = new Map(state.links || []);
const requirementLinks = new Map(state.requirements || []);
const projectNotes = new Map(state.projectNotes || []);
const personalPlans = Array.isArray(state.plans) ? state.plans : [];
let bookmarks=Array.isArray(state.bookmarks)?state.bookmarks:[];
let homePlatforms=Array.isArray(state.homePlatforms)?state.homePlatforms:null;
let timeChanges=state.timeChanges || {};
let synced = state.synced === true;
let showingDone = false;
let selected;
let activeProject;

// Dates: keys are 'YYYY-MM-DD' in Asia/Shanghai; arithmetic runs on UTC midnights.
const zone = 'Asia/Shanghai';
const todayKey = () => new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format(new Date());
const nowTime = () => new Intl.DateTimeFormat('sv-SE',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
function dateKey(d) { return d.toISOString().slice(0,10); }
function calendarDate(key) { return new Date(key+'T00:00:00Z'); }
function addDays(key, n) { return dateKey(new Date(calendarDate(key).valueOf()+n*86400000)); }
function daysUntil(key) { return Math.round((calendarDate(key)-calendarDate(todayKey()))/86400000); }
function shortDate(key) { return key ? key.slice(5).replace('-','/') : '待公布'; }
function teachingWeek(key) {
  const diff = Math.floor((calendarDate(key) - calendarDate(semesterTerm.start)) / 86400000);
  const week = Math.floor(diff / 7) + 1;
  return week >= 1 && week <= semesterTerm.weeks ? week : null;
}
function holidayOf(key) {
  return datedHolidays[key] || solarHolidays[key.slice(5)] || null;
}
let selectedDay = todayKey();

// Keep the recovery snapshot in the same atomic localStorage write as the live state.
let recoverySnapshot = state.recovery || null;
function personalData() {
  return {done:[...done], notes:[...notes], links:[...taskLinks], requirements:[...requirementLinks],
    projectNotes:[...projectNotes], plans:personalPlans, synced,
    ...(bookmarks.length?{bookmarks}:{}),
    ...(homePlatforms!==null?{homePlatforms}:{}),
    ...(Object.keys(timeChanges).length?{timeChanges}:{})};
}
function writePersonalData(data, snapshot) {
  if (localStorage.getItem(storageKey)!==lastStored) throw new Error('其他标签页已更新数据，请刷新后重试。');
  const raw=JSON.stringify({...data,recovery:snapshot});
  localStorage.setItem(storageKey,raw);
  lastStored=raw;
}
function persist() {
  try {
    writePersonalData(personalData(),recoverySnapshot);
    return true;
  } catch { return false; }
}
function node(tag, content, className) {
  const el = document.createElement(tag);
  if (content != null) el.textContent = content;
  if (className) el.className = className;
  return el;
}
function button(label, onClick, className='text-button') {
  const b = node('button',label,className);
  b.type='button'; b.onclick=onClick;
  return b;
}
function link(name, url) {
  const a = node('a', name + ' ↗', 'tool-link');
  a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; return a;
}
function httpUrl(value) {
  try { const url=new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
function list() {
  const seeded = scheduleExamples.filter(t => synced || t.id !== 'quiz-window').map(t =>
    synced && t.id === 'logic' ? {...t, date:'2026-11-24', original:'2026-11-22', change:'已延期'} : t);
  return [...seeded.map(t=>timeChanges[t.id]?{...t,...timeChanges[t.id]}:t),...personalPlans].sort((a,b) =>
    (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99'));
}
// Filter values: '' (all), 'c:<course number>' or 'p:<project id>'.
// A task without its own courses inherits the courses of its project.
function matchesFilter(t, value) {
  if (!value) return true;
  if (value.startsWith('p:')) return t.project === value.slice(2);
  const courses = t.courses?.length ? t.courses : projectsById.get(t.project)?.courses || [];
  return courses.includes(Number(value.slice(2)));
}
function fillFilter(select, allLabel) {
  select.add(new Option(allLabel,''));
  for (const [name,options] of [
    ['课程',[...courseByNumber].map(([n,c]) => [c.name,'c:'+n])],
    ['项目',projectCatalog.map(p => [p.name,'p:'+p.id])]
  ]) {
    const group=node('optgroup'); group.label=name;
    for (const [label,value] of options) group.append(new Option(label,value));
    select.append(group);
  }
}
function owner(t) {
  const names=(t.courses || []).map(n => courseByNumber.get(n)?.name).filter(Boolean);
  return names.join('、') || projectsById.get(t.project)?.name || '个人安排';
}
function when(t) {
  if (!t.date) return '日期待定';
  if (t.openDate) return '开放 '+t.openDate+' '+t.openTime+' → '+t.date+' '+t.time+' 截止 · 开始后限时 '+t.duration+' 分钟';
  const time = t.time ? t.time + (t.endTime ? '–'+t.endTime : '') : '时刻待定';
  return t.date+' '+time+' · '+(t.kind || kind[t.type]);
}
function source(t) { return t.source || '个人安排'; }
// Time pressure for unfinished dated items, relative to the current Shanghai date and time.
function urgency(t) {
  if (!t.date || done.has(t.id)) return null;
  const days = daysUntil(t.date);
  const ended = days < 0 || (days === 0 && t.time && (t.endTime || t.time) < nowTime());
  if (ended) return t.type === 'attendance' ? {label:'已结束',cls:'past'} : {label:'已逾期',cls:'overdue'};
  if (days === 0) return {label:['deadline','quiz'].includes(t.type) ? '今天截止' : '今天',cls:'today'};
  if (days === 1) return {label:'明天',cls:'soon'};
  if (days <= 3) return {label:days+' 天后',cls:'soon'};
  return null;
}
function urgencyTag(t) { const u=urgency(t); return u ? node('span',u.label,'tag '+u.cls) : null; }

function showTask(t) {
  selected=t;
  $('detail-course').textContent=owner(t)+' / '+source(t);
  $('detail-title').textContent=t.title;
  $('detail-meta').textContent=[when(t),t.place,t.original && '已延期 · 原截止 '+t.original+' '+t.time].filter(Boolean).join('\n');
  $('detail-brief').textContent=t.brief || '自行安排的项目节点';
  $('next-step').value=notes.get(t.id) ?? t.note ?? '';
  $('save-status').textContent='进度保存在当前浏览器';
  $('toggle-done').textContent=done.has(t.id) ? '恢复为待处理' : t.type==='deadline' ? '手动标记已提交' : '标记已完成';
  $('personal-actions').hidden=!personalPlans.includes(t);
  renderLinks(t);
  if (t.studyFor) {
    const original=list().find(item=>item.id===t.studyFor);
    if (original) $('detail-links').prepend(button('查看原事项 · '+original.title,()=>showTask(original),'tool-link'));
  } else if (t.date && t.time && ['attendance','plan'].includes(t.type)) {
    $('detail-links').prepend(button('调整时段',()=>openSession(t,true),'secondary'));
  } else if (canScheduleStudy(t)) {
    $('detail-links').prepend(button('安排学习时段',()=>openSession(t),'secondary'));
  }
  $('detail').showModal();
}
function pathResource(name, path) {
  if (httpUrl(path)) return link(name,path);
  const row=node('div',null,'path-row');
  const head=node('div',name,'path-head');
  const input=node('input'); input.readOnly=true; input.value=path.replaceAll('/','\\'); input.setAttribute('aria-label',name+'本机路径');
  const copy=button('复制路径',async()=>{
    try { await navigator.clipboard.writeText(input.value); copy.textContent='已复制'; }
    catch { input.focus(); input.select(); copy.textContent='已选中，可复制'; }
  });
  head.append(copy); row.append(head,input); return row;
}
function urlField(t, map, label, action) {
  const group=node('div',null,'related');
  const saved=httpUrl(map.get(t.id));
  if(saved) group.append(link(action,saved));
  group.append(button((saved?'更改':'＋ 添加')+label,()=>{
    const form=node('form',null,'related');
    const input=node('input'); input.type='url'; input.required=true; input.value=saved || ''; input.placeholder='https://…'; input.setAttribute('aria-label',label);
    const save=node('button','保存','secondary');
    form.append(input,save,button('取消',()=>renderLinks(t)));
    group.replaceWith(form); input.focus();
    input.oninput=()=>input.setCustomValidity('');
    form.onsubmit=event=>{
      event.preventDefault();
      const url=httpUrl(input.value.trim());
      if(!url){input.setCustomValidity('请填写 HTTP 或 HTTPS 网址');input.reportValidity();return;}
      map.set(t.id,url); $('save-status').textContent=persist()?'链接已保存':'仅在本次打开期间有效'; renderLinks(t);
    };
  }));
  return group;
}
function renderLinks(t) {
  const box=$('detail-links'); box.replaceChildren();
  const project=projectsById.get(t.project);
  if(project) {
    const group=node('div',null,'resource-group');
    group.append(node('h3','项目资料 · '+project.name));
    for(const resource of project.resources) group.append(pathResource(...resource));
    box.append(group);
  }
  const related=node('div',null,'related');
  for(const name of t.tools || []) {const tool=tools.find(v=>v.name===name); if(tool) related.append(link(name,tool.url));}
  if(related.childElementCount) box.append(node('div','相关工具','related-title'),related);
  box.append(urlField(t,requirementLinks,'要求链接','查看原文'),urlField(t,taskLinks,'提交链接','去提交'));
}
function taskRow(t) {
  const u=urgency(t);
  const row=button('',()=>showTask(t),'row');
  const due=node('span',shortDate(t.date),'due'+(u && ['overdue','today'].includes(u.cls) ? ' urgent' : ''));
  due.append(node('small',t.time || '时刻待定'));
  const body=node('span');
  const meta=node('p',kind[t.type]+' · '+owner(t)+' · '+source(t));
  if(u) meta.append(node('span',u.label,'tag '+u.cls));
  const change=t.change || (t.id==='quiz-window'?'新发布':'');
  if(change) meta.append(node('span',change,'tag'));
  body.append(node('strong',t.title),meta);row.append(due,body,node('span','›','arrow'));return row;
}
function renderInbox(tasks) {
  const first=tasks.find(t=>!done.has(t.id) && t.type==='deadline');
  const u=first && urgency(first);
  $('hero-label').textContent='近期交付'+(u ? ' · '+u.label : '');
  $('hero-title').textContent=first?.title || '当前交付已处理完';
  $('hero-meta').textContent=first ? owner(first)+' · '+source(first)+' · '+when(first) : '可以查看其他安排。';
  $('continue').hidden=!first; $('continue').onclick=first ? ()=>showTask(first) : null;
  $('paper-day').textContent=first?.date?.slice(-2) || '—'; $('paper-time').textContent=first?.time || 'TBD';
  const filtered=tasks.filter(t=>matchesFilter(t,$('course-filter').value));
  const pending=filtered.filter(t=>!done.has(t.id)).length;
  $('pending').textContent='待处理 '+pending; $('finished').textContent='已完成 '+(filtered.length-pending);
  $('pending').setAttribute('aria-pressed',String(!showingDone)); $('finished').setAttribute('aria-pressed',String(showingDone));
  const matches=filtered.filter(t=>done.has(t.id)===showingDone);
  $('rows').replaceChildren(...matches.map(taskRow));
  if(!matches.length) $('rows').append(node('p','这个范围内暂无事项。','empty'));
}
function route() {
  const pages=['overview','desk','calendar','inbox','projects','courses','tools'];
  const hash=location.hash.slice(1);
  const page=pages.includes(hash)?hash:'overview';
  for(const section of document.querySelectorAll('main > section')) section.hidden=section.id!==page;
  for(const a of document.querySelectorAll('nav a')) {
    if(a.hash==='#'+page) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  }
  if (page==='desk') renderWorkspace(list());
  if (page==='tools') renderBookmarks();
  if (page==='overview') renderOverview(list());
}
function render() { if (!$('tools').hidden) renderBookmarks(); const tasks=list(); renderCalendar(tasks); renderInbox(tasks); renderProjects(tasks); renderWorkspace(tasks); renderOverview(tasks); }
function syncInfo(text) {
  $('sync-info').textContent=text || (synced?'已模拟新增概率论线上小测，触发器实验报告已延期。':'示例快照 · 11月21日 09:00');
}

$('next-step').oninput=e=>{notes.set(selected.id,e.target.value);$('save-status').textContent=persist()?'已保存到本浏览器':'仅在本次打开期间保留';};
function toggleTaskDone(t) {
  if(done.has(t.id)) done.delete(t.id); else done.add(t.id);
  const saved=persist();
  render();
  return saved;
}
$('toggle-done').onclick=()=>{toggleTaskDone(selected);$('detail').close();};
for(const b of document.querySelectorAll('.close')) b.onclick=()=>b.closest('dialog').close();

fillFilter($('course-filter'),'全部课程与项目');
for(const [n,c] of courseByNumber) {
  const card=node('article',null,'course-card');
  card.append(node('small',c.credits+' 学分'),node('h2',c.name),node('p',c.components.map(s=>s.name+' '+s.weight+'%').join(' · ') || '暂无考核构成'),
    button('查看课程安排 →',()=>{$('course-filter').value='c:'+n;showingDone=false;render();location.hash='inbox';}));
  for(const p of projectCatalog.filter(p=>p.courses?.includes(n))) card.append(node('br'),button(p.name+' ↗',()=>openProject(p)));
  $('course-grid').append(card);
}
$('shortcuts').className='quick-links';
for(const name of ['GitHub','Google Scholar','arXiv','Overleaf']) { const t=tools.find(v=>v.name===name); if(t) $('shortcuts').append(link(t.name,t.url)); }
for(const [name,status,style] of [['Canvas','已检查',''],['学习通','已检查',''],['智慧树','需要登录','warn'],['校内课程站','未接入','off']]) {
  const row=node('div',null,'source');row.append(node('i',null,'dot '+style),node('span',name),node('small',status));$('sources').append(row);
}
$('course-filter').onchange=render;
$('pending').onclick=()=>{showingDone=false;render();};
$('finished').onclick=()=>{showingDone=true;render();};
const currentWeek = teachingWeek(todayKey());
$('calendar-eyebrow').textContent = semesterTerm.name + (currentWeek ? ' · 第 ' + currentWeek + ' 周' : '');
$('inbox-eyebrow').textContent = currentWeek ? '教学第 ' + currentWeek + ' 周 / 共 ' + semesterTerm.weeks + ' 周' : semesterTerm.name;
syncInfo();
$('sync').onclick=()=>{
  const repeated=synced;synced=true;persist();render();
  syncInfo(repeated?'本次模拟检查没有新变化。':'新增概率论线上小测；触发器实验报告从 11月22日 延至 11月24日。');
};
$('reset').onclick=()=>{
  if(!confirm('清除本浏览器中的完成状态、笔记、链接、个人网站和个人计划，并恢复同步前的示例？')) return;
  try { localStorage.removeItem(storageKey); lastStored=null; } catch { syncInfo('无法重置浏览器存储。'); return; }
  recoverySnapshot=null; $('undo-import').hidden=true;
  for(const store of [done,notes,taskLinks,requirementLinks,projectNotes]) store.clear();
  personalPlans.length=0; bookmarks=[]; homePlatforms=null; timeChanges={}; synced=false; showingDone=false;
  render(); syncInfo('演示数据已重置为示例快照。');
};
window.addEventListener('hashchange',route);
