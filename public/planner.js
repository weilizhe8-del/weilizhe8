'use strict';

// Month calendar and project library. Uses state and helpers defined in desk.js.

function monthStart(offset) {
  const d=calendarDate(selectedDay);
  return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,1));
}
// Same day of month in another month, clamped to that month's last day.
function shiftMonth(key,offset) {
  const d=calendarDate(key);
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset+1,0)).getUTCDate();
  return dateKey(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+offset,Math.min(d.getUTCDate(),last))));
}
function entriesOn(tasks,key) {
  const entries=[];
  for(const t of tasks) {
    if(t.openDate===key) entries.push({t,label:'开放',time:t.openTime || ''});
    if(t.date===key) entries.push({t,label:t.openDate?'截止':kind[t.type],time:t.time || ''});
  }
  return entries.sort((a,b)=>(a.time || '99').localeCompare(b.time || '99'));
}
function agendaItem(t,label,time) {
  const finished=done.has(t.id);
  const row=button('',()=>showTask(t),'agenda-item'+(finished?' is-done':''));
  const meta=node('small',[label,time,owner(t)].filter(Boolean).join(' · ')+(finished?' · 已完成':''));
  const tag=urgencyTag(t);
  if(tag) meta.append(' ',tag);
  row.append(meta,node('strong',t.title));
  return row;
}
function selectDay(key) {
  selectedDay=key;
  renderCalendar(list());
  $('days').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
}
function renderCalendar(tasks) {
  const filtered=tasks.filter(t=>matchesFilter(t,$('calendar-filter').value));
  const start=monthStart(0);
  const month=start.getUTCMonth();
  const nextMonth=monthStart(1);
  const offset=(start.getUTCDay()+6)%7;
  const length=(nextMonth-start)/86400000;
  const cells=Math.ceil((length+offset)/7)*7;
  const today=todayKey();
  const todayWeek=teachingWeek(today);
  $('month').textContent=start.getUTCFullYear()+' 年 '+(month+1)+' 月';
  $('days').replaceChildren();
  for(let i=0;i<cells;i++) {
    const date=new Date(start.valueOf()+(i-offset)*86400000);
    const key=dateKey(date);
    if(i%7===0) {
      const rowWeek=teachingWeek(key);
      const wCell=node('div',null,'week-cell'+(rowWeek && rowWeek===todayWeek ? ' current' : !rowWeek ? ' off' : ''));
      wCell.setAttribute('aria-hidden','true');
      if(rowWeek) wCell.append(node('span','第'+rowWeek+'周','week-full'),node('span',rowWeek+'周','week-short'));
      $('days').append(wCell);
    }
    const entries=entriesOn(filtered,key);
    const cell=button('',()=>{
      selectDay(key);
      if(matchMedia('(max-width:510px)').matches) $('agenda-title').scrollIntoView({block:'nearest'});
    },'day-cell'+(date.getUTCMonth()!==month?' outside':''));
    cell.dataset.date=key;cell.setAttribute('aria-pressed',String(key===selectedDay));
    cell.tabIndex=key===selectedDay?0:-1;
    if(key===today) cell.setAttribute('aria-current','date');
    const pending=entries.filter(e=>!done.has(e.t.id)).length;
    const dayWeek=teachingWeek(key);
    const hol=holidayOf(key);
    cell.setAttribute('aria-label',key+(dayWeek?'，第'+dayWeek+'周':'')+(hol?'，'+hol:'')+'，'+entries.length+'项安排'+(entries.length>pending?'，'+(entries.length-pending)+'项已完成':''));
    const head=node('div',null,'day-head');
    if(hol) { const h=node('span',hol,'day-holiday'); h.title=hol; head.append(h); }
    head.append(node('span',String(date.getUTCDate()),'day-number'));
    cell.append(head);
    for(const {t,label} of entries.slice(0,2)) {
      const finished=done.has(t.id);
      const tag=node('span',label+' '+t.title,'event-tag '+t.type+(finished?' done':''));
      tag.title=tag.textContent+(finished?'（已完成）':'');cell.append(tag);
    }
    if(entries.length>2) cell.append(node('span','另有 '+(entries.length-2)+' 项','day-extra'));
    $('days').append(cell);
  }
  $('agenda-title').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',month:'long',day:'numeric',weekday:'short'}).format(calendarDate(selectedDay));
  const selWeek=teachingWeek(selectedDay);
  const selHol=holidayOf(selectedDay);
  $('agenda-meta').replaceChildren(node('span',selWeek ? '第 '+selWeek+' 周（共 '+semesterTerm.weeks+' 周）' : '非教学周'));
  if(selHol) $('agenda-meta').append(node('span',selHol,'tag holiday'));
  const daily=entriesOn(filtered,selectedDay);
  $('agenda-list').replaceChildren(...daily.map(e=>agendaItem(e.t,e.label,e.time || '时刻待定')));
  if(!daily.length) $('agenda-list').append(node('p','当天没有已排期的事项。','empty'));
  const waiting=filtered.filter(t=>!t.date);
  $('undated').replaceChildren(...waiting.map(t=>agendaItem(t,kind[t.type],'')));
  if(!waiting.length) $('undated').append(node('p','暂无待定事项。','empty'));
}
const calendarFilter=$('calendar-filter');
fillFilter(calendarFilter,'全部课程与项目');
calendarFilter.onchange=render;
$('prev').onclick=()=>{selectedDay=dateKey(monthStart(-1));render();};
$('next').onclick=()=>{selectedDay=dateKey(monthStart(1));render();};
$('today').onclick=()=>{selectedDay=todayKey();render();};
// Arrow keys move by day/week, Home/End to week edges, PageUp/PageDown by month.
$('days').addEventListener('keydown',e=>{
  if(e.altKey || e.ctrlKey || e.metaKey) return;
  const weekday=(calendarDate(selectedDay).getUTCDay()+6)%7;
  const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-weekday,End:6-weekday};
  let next;
  if(e.key in moves) next=addDays(selectedDay,moves[e.key]);
  else if(e.key==='PageUp' || e.key==='PageDown') next=shiftMonth(selectedDay,e.key==='PageUp'?-1:1);
  else return;
  e.preventDefault();
  selectDay(next);
});

function renderProjectEvents() {
  const events=list().filter(t=>t.project===activeProject.id);
  $('project-events').replaceChildren(...events.map(t=>agendaItem(t,kind[t.type],t.date?shortDate(t.date):'日期待定')));
  if(!events.length) $('project-events').append(node('p','尚未安排节点。','empty'));
}
function openProject(p) {
  activeProject=p;
  $('project-category').textContent=p.group;
  $('project-name').textContent=p.name;
  $('project-about').textContent=[p.about,...(p.courses || []).map(n=>courseByNumber.get(n)?.name).filter(Boolean)].join(' · ');
  $('project-resources').replaceChildren(...p.resources.map(r=>pathResource(...r)));
  $('project-note').value=projectNotes.get(p.id) || '';
  $('project-status').textContent='保存在当前浏览器';
  $('plan-form').reset();$('plan-date').value=selectedDay;
  renderProjectEvents();
  $('project-dialog').showModal();
}
function renderProjects(tasks=list()) {
  const group=$('project-group').value;
  const cards=projectCatalog.filter(p=>!group || p.group===group).map(p=>{
    const events=tasks.filter(t=>t.project===p.id);
    const next=events.find(t=>t.date && !done.has(t.id) && urgency(t)?.cls!=='past');
    const card=button('',()=>openProject(p),'course-card project-card');
    const status=node('span',next ? '下一节点 · '+shortDate(next.date)+' '+next.title : events.length ? '节点均已完成或待定' : '尚未安排节点','project-next'+(next?'':' idle'));
    const tag=next && urgencyTag(next);
    if(tag) status.append(tag);
    card.append(node('small',p.group+(events.length?' · '+events.length+' 项安排':'')),node('h2',p.name),node('p',p.about),status);
    return card;
  });
  $('project-grid').replaceChildren(...cards);
}
$('project-group').add(new Option('全部项目',''));
for(const group of new Set(projectCatalog.map(p=>p.group))) $('project-group').add(new Option(group,group));
$('project-group').onchange=()=>renderProjects();
$('project-note').oninput=e=>{
  projectNotes.set(activeProject.id,e.target.value);
  $('project-status').textContent=persist()?'下一步已保存':'仅在本次打开期间保留';
};
$('plan-name').oninput=()=>$('plan-name').setCustomValidity('');
$('plan-form').onsubmit=e=>{
  e.preventDefault();
  const title=$('plan-name').value.trim();
  if(!title) {$('plan-name').setCustomValidity('请输入节点名称');$('plan-name').reportValidity();return;}
  const date=$('plan-date').value;
  const id='plan-'+(crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2));
  const plan={id,title,date,time:$('plan-time').value,type:'plan',project:activeProject.id,courses:activeProject.courses || []};
  personalPlans.push(plan);
  if(!persist()) {
    personalPlans.pop();
    $('project-status').textContent='浏览器未能保存计划，请检查存储后重试。';return;
  }
  selectedDay=date;
  calendarFilter.value='p:'+activeProject.id;
  $('project-dialog').close();
  location.hash='calendar';render();
};
$('detail').addEventListener('close',()=>{if($('project-dialog').open) renderProjectEvents();});
