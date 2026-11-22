'use strict';

let boardStart=selectedDay;
let activeSession=null;
let dragEffect='';
const taskDragType='application/x-student-desk-task';
const weekday=new Intl.DateTimeFormat('zh-CN',{weekday:'long',timeZone:'UTC'});
const displayDay=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'});

function canScheduleStudy(t) {
  return ['deadline','quiz'].includes(t.type) && !done.has(t.id);
}
function timeMinutes(time) {
  const [hour,minute]=time.split(':').map(Number);
  return hour*60+minute;
}
function clockTime(value) {
  return [Math.floor(value/60),value%60].map(n=>String(n).padStart(2,'0')).join(':');
}
function bindTaskDrag(element,t,effect) {
  element.draggable=true;
  element.ondragstart=e=>{
    dragEffect=effect;
    element.classList.add('is-dragging');
    $('desk').classList.add('is-dragging-task');
    e.dataTransfer.setData(taskDragType,t.id);
    e.dataTransfer.effectAllowed=effect;
  };
  element.ondragend=()=>{
    dragEffect='';
    element.classList.remove('is-dragging');
    $('desk').classList.remove('is-dragging-task');
    clearDrop();
  };
}
function saveTimeBlock(block,creating=false) {
  const data=personalData();
  if(creating) data.plans=[...personalPlans,block];
  else if(personalPlans.some(t=>t.id===block.id)) data.plans=personalPlans.map(t=>t.id===block.id?block:t);
  else data.timeChanges={...timeChanges,[block.id]:{date:block.date,time:block.time,endTime:block.endTime}};
  installPersonalData(data);
}
function busyIntervals(tasks,day) {
  return tasks.filter(t=>t.date===day && t.time && ['attendance','plan'].includes(t.type)).map(t=>{
    const start=timeMinutes(t.time);
    return {task:t,start,end:t.endTime?timeMinutes(t.endTime):Math.min(1440,start+30)};
  }).sort((a,b)=>a.start-b.start || b.end-a.end);
}
function openSession(task,editing=false,date=selectedDay,time='') {
  activeSession={task,editing};
  $('session-title').textContent=editing?'调整时段':'安排学习时段';
  $('session-task').textContent=task.title+(editing?'':task.date?' · 截止 '+shortDate(task.date)+' '+(task.time || '时刻待定'):' · 截止待定');
  $('study-date').value=editing?task.date:date;
  let start=time;
  if (!start) {
    const busy=busyIntervals(list(),date);
    let minute=9*60;
    for (const block of busy) {
      if (block.start>=minute+45) break;
      if (block.end>minute) minute=block.end;
    }
    start=clockTime(Math.min(minute,23*60));
  }
  $('study-start').value=editing?task.time:start;
  $('study-end').value=editing?(task.endTime || clockTime(Math.min(1439,timeMinutes(task.time)+30))):clockTime(Math.min(1439,timeMinutes(start)+45));
  sessionHint();
  $('session-dialog').showModal();
}
function sessionHint() {
  const start=$('study-start').value,end=$('study-end').value,day=$('study-date').value;
  $('study-end').setCustomValidity(start && end && end<=start?'结束时间应晚于开始时间':'');
  const overlaps=busyIntervals(list(),day).find(b=>b.task.id!==activeSession?.task.id && start && end &&
    b.start<timeMinutes(end) && b.end>timeMinutes(start));
  $('session-conflict').textContent=overlaps?'与「'+overlaps.task.title+'」重叠，可调整或保留此时段。':'';
}
$('session-form').oninput=sessionHint;
$('session-form').onsubmit=e=>{
  e.preventDefault();
  const {task,editing}=activeSession;
  const block=editing?{...task}:{id:'plan-'+(crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2)),
    studyFor:task.id,title:task.title,type:'plan',source:'学习时段',brief:'为「'+task.title+'」预留的学习时间。',
    project:task.project || '',courses:task.courses || []};
  Object.assign(block,{date:$('study-date').value,time:$('study-start').value,endTime:$('study-end').value});
  try { saveTimeBlock(block,!editing); } catch(error) { $('session-conflict').textContent='保存失败：'+error.message; return; }
  selectedDay=block.date;
  $('session-dialog').close();
  if ($('detail').open) $('detail').close();
  if ($('project-dialog').open) $('project-dialog').close();
  location.hash='desk'; render();
  $('desk-message').textContent='已安排 '+shortDate(block.date)+' '+block.time+'–'+block.endTime+' · '+block.title;
};
function workCard(t,label,time,compact=false) {
  const item=node('div',null,(compact?'queue-row':'work-card')+(done.has(t.id)?' is-done':''));
  const open=button(t.title,()=>showTask(t),'work-open');
  const schedule=canScheduleStudy(t);
  if (schedule) bindTaskDrag(item,t,'copy');
  else if(t.time && ['attendance','plan'].includes(t.type)) bindTaskDrag(item,t,'move');
  const action=schedule?button('排时段',()=>openSession(t),'slot-action'):null;
  if(compact) {
    item.append(open,node('small',owner(t)+' · '+(t.date?shortDate(t.date):'日期待定')));
    if(action) item.append(action);
    return item;
  }
  const meta=node('div',null,'task-meta');
  meta.append(node('span',[label,time].filter(Boolean).join(' · '),'task-badge '+t.type));
  if(action) meta.append(action);
  const check=node('input',null,'task-check');
  check.type='checkbox';
  check.checked=done.has(t.id);
  check.setAttribute('aria-label',(t.type==='deadline'?'手动标记已提交：':'标记已完成：')+t.title);
  const heading=node('div',null,'task-heading');
  heading.append(check,open);
  item.append(node('div',[owner(t),source(t)].filter(Boolean).join(' · '),'owner'),heading,meta);
  check.onchange=()=>{
    const checks=[...$('desk-columns').querySelectorAll('.task-check')];
    const index=checks.indexOf(check);
    const saved=toggleTaskDone(t);
    $('desk-columns').querySelectorAll('.task-check')[index]?.focus({preventScroll:true});
    $('desk-message').textContent=saved?'':'本次更改只保留在当前页面，浏览器存储写入失败。';
  };
  return item;
}
function addOnDay(day) {
  selectedDay=day;
  openEntryForm();
  $('entry-course').value=''; $('entry-project').value='';
  renderWorkspace(list());
}
function clearDrop() {
  for (const row of $('hours').querySelectorAll('.drop')) row.classList.remove('drop');
}
let fullDay=false;
let timelineDate='';
$('timeline-range').onclick=()=>{
  fullDay=!fullDay;
  timelineDay(list());
};

function timelineDay(tasks) {
  const scroller=$('hour-scroll');
  const previousScroll=timelineDate===selectedDay ? scroller.scrollTop : 0;
  timelineDate=selectedDay;
  $('timeline-day').textContent=displayDay.format(calendarDate(selectedDay)).replace(/(周.)$/,' · $1');
  $('timeline-range').textContent=fullDay?'收起全天':'显示全天';
  $('timeline-range').setAttribute('aria-pressed',String(fullDay));
  scroller.classList.toggle('full-day',fullDay);
  const due=$('timeline-due'); due.replaceChildren();
  for(const {t,label,time} of entriesOn(tasks,selectedDay)) {
    if (['deadline','quiz'].includes(t.type) || !time) {
      const action=t.type==='deadline' && label!=='开放'?'截止':label;
      const row=button('',()=>showTask(t),'timeline-notice '+t.type);
      row.append(node('span',action,'notice-kind'),node('strong',t.title),node('small',time || '时间待定'));
      due.append(row);
    }
  }

  const intervals=busyIntervals(tasks,selectedDay);
  const slots=new Map();
  for(const interval of intervals) {
    const slot=Math.floor(interval.start/30)*30;
    if(!slots.has(slot)) slots.set(slot,[]);
    slots.get(slot).push(interval);
  }
  $('timeline-empty').hidden=intervals.length>0;
  const first=fullDay?0:intervals.length?Math.max(0,Math.floor(intervals[0].start/60)-1):8;
  const last=fullDay?24:intervals.length?Math.min(24,Math.ceil(Math.max(...intervals.map(b=>b.end))/60)+1):12;
  const grid=$('hours');grid.replaceChildren();
  for(let hour=first;hour<last;hour++) {
    let next=hour;
    while(!fullDay && next<last && !slots.has(next*60) && !slots.has(next*60+30)) next++;
    if(next-hour>=3 && intervals.length) {
      const start=hour;
      const gap=button(clockTime(start*60)+'–'+clockTime(next*60)+'　展开时段',()=>{
        fullDay=true;timelineDay(list());
        const target=grid.querySelector('[data-time="'+clockTime(start*60)+'"]');
        $('hour-scroll').scrollTop=target.getBoundingClientRect().top-$('hour-scroll').getBoundingClientRect().top;
        $('timeline-range').focus({preventScroll:true});
      },'time-gap');
      grid.append(gap);hour=next-1;continue;
    }
    const row=node('div',null,'hour');
    row.append(node('span',clockTime(hour*60),'hour-label'));
    for(const minute of [hour*60,hour*60+30]) {
      const slot=node('div',null,'half-hour');
      slot.dataset.time=clockTime(minute);
      const items=slots.get(minute) || [];
      if(items.length>1) slot.classList.add('is-crowded');
      for(const {task,start,end} of items) {
        const collision=intervals.some(b=>b.task.id!==task.id && b.start<end && b.end>start);
        const card=button('',()=>showTask(task),'time-block '+task.type+(collision?' is-overlap':''));
        const range=task.endTime?task.time+'–'+task.endTime:task.time;
        const meta=node('small',range);
        if(collision) meta.append(' ',node('span','重叠','overlap-pill'));
        card.append(node('strong',task.title),meta);
        card.title=task.title+' · '+when(task);
        bindTaskDrag(card,task,'move');
        slot.append(card);
      }
      row.append(slot);
    }
    grid.append(row);
  }
  scroller.scrollTop=previousScroll;
}
function dropSlot(e) {
  const row=e.target.closest('.hour');
  if(!row) return null;
  const second=row.lastElementChild;
  return e.target.closest('.half-hour') || (e.clientY>=second.getBoundingClientRect().top?second:second.previousElementSibling);
}
$('hours').ondragover=e=>{
  const slot=dropSlot(e);
  if(!slot || !dragEffect || !e.dataTransfer.types.includes(taskDragType)) return;
  e.preventDefault();e.dataTransfer.dropEffect=dragEffect;
  clearDrop();slot.classList.add('drop');
};
$('hours').ondragleave=e=>{if(!$('hours').contains(e.relatedTarget)) clearDrop();};
$('hours').ondrop=e=>{
  const t=list().find(item=>item.id===e.dataTransfer.getData(taskDragType));
  const slot=dropSlot(e);
  if(!t || !slot || !dragEffect) return;
  e.preventDefault();clearDrop();
  $('desk').classList.remove('is-dragging-task');
  for(const el of document.querySelectorAll('.is-dragging')) el.classList.remove('is-dragging');
  const time=slot.dataset.time;
  const effect=dragEffect;dragEffect='';
  if(effect==='copy' && canScheduleStudy(t)) {openSession(t,false,selectedDay,time);return;}
  if(effect!=='move' || !['plan','attendance'].includes(t.type) || !t.time) return;
  const duration=t.endTime?timeMinutes(t.endTime)-timeMinutes(t.time):30;
  const start=Math.min(timeMinutes(time),1439-duration);
  const block={...t,date:selectedDay,time:clockTime(start),endTime:clockTime(start+duration)};
  const conflict=busyIntervals(list(),selectedDay).find(b=>b.task.id!==t.id && b.start<start+duration && b.end>start);
  try { saveTimeBlock(block); }
  catch(error) { $('desk-message').textContent='移动失败：'+error.message;return; }
  render();
  $('desk-message').textContent='已移动至 '+block.time+'–'+block.endTime+(conflict?'，与「'+conflict.task.title+'」重叠。':'。');
};
function renderWorkspace(tasks) {
  if(selectedDay!==boardStart && selectedDay!==addDays(boardStart,1)) boardStart=selectedDay;
  const week=teachingWeek(selectedDay);
  $('desk-date').textContent=semesterTerm.name+(week?' · 教学第 '+week+' 周':'')+' · 内置排期为示例';
  const columns=$('desk-columns');columns.replaceChildren();
  for(const day of [boardStart,addDays(boardStart,1)]) {
    const col=node('section',null,'board-day'+(day===selectedDay?' is-selected':''));
    const head=node('div',null,'column-heading');
    const title=button(day===todayKey()?'今天':day===addDays(todayKey(),1)?'明天':weekday.format(calendarDate(day)),()=>{
      selectedDay=day;render();
    },'');
    title.setAttribute('aria-pressed',String(selectedDay===day));title.title='查看当天时间轴';
    title.append(node('small',shortDate(day)));
    const add=button('＋',()=>addOnDay(day),'add-day');add.setAttribute('aria-label','为 '+day+' 新建安排');
    head.append(title,add);col.append(head);
    const entries=entriesOn(tasks,day);
    const taskIds=new Set(entries.map(entry=>entry.t.id));
    if(taskIds.size) {
      const finished=[...taskIds].filter(id=>done.has(id)).length;
      const summary=node('div',null,'day-progress');
      const meter=node('progress');
      meter.max=taskIds.size;meter.value=finished;meter.setAttribute('aria-label',shortDate(day)+'完成进度');
      summary.append(node('span','已完成 '+finished+' / '+taskIds.size),meter);
      col.append(summary);
    }
    for(const {t,label,time} of entries) col.append(workCard(t,t.type==='deadline' && label!=='开放'?'截止':label,time));
    if(!entries.length) col.append(node('p','当天暂无安排','empty'));
    columns.append(col);
  }
  const weekEnd=addDays(selectedDay,7);
  const scope=$('queue-scope').value;
  const queue=tasks.filter(t=>canScheduleStudy(t) && !tasks.some(block=>block.studyFor===t.id && !done.has(block.id)) &&
    (scope==='all' || (scope==='undated'?!t.date:t.date && t.date<=weekEnd)));
  $('desk-queue').replaceChildren(...queue.map(t=>workCard(t,'','',true)));
  if(!queue.length) $('desk-queue').append(node('p','这个范围内没有待安排的任务。','empty'));
  timelineDay(tasks);
}
for (const id of deskProfile.pins) {
  const p=projectsById.get(id);
  const btn=button('',()=>openProject(p),'');
  btn.title=p.name;
  btn.append(node('span',p.name,'pin-label'));
  $('desk-pins').append(btn);
}
for (const name of ['GitHub','Overleaf','Google Scholar']) {
  const tool=tools.find(t=>t.name===name);
  const a=link(tool.name,tool.url);a.className='';a.textContent=name;a.append(node('span','↗'));$('desk-tools').append(a);
}
function renderOverview(tasks) {
  renderHomePlatforms();
  const today=todayKey();
  const week=teachingWeek(today);
  const date=new Intl.DateTimeFormat('zh-CN',{dateStyle:'full',timeZone:'UTC'}).format(calendarDate(today));
  $('overview-date').textContent=date+(week?' · 教学第 '+week+' 周':'');
  const hour=Number(nowTime().slice(0,2));
  $('overview-greeting').textContent=hour<6?'夜深了。':hour<11?'早上好。':hour<14?'中午好。':hour<18?'下午好。':'晚上好。';

  const entries=entriesOn(tasks,today);
  const todayIds=new Set(entries.map(entry=>entry.t.id));
  const finished=[...todayIds].filter(id=>done.has(id)).length;
  const progress=$('overview-progress');
  if(todayIds.size) {
    const meter=node('progress');
    meter.max=todayIds.size; meter.value=finished;
    meter.setAttribute('aria-label','今日完成进度');
    progress.replaceChildren(node('span','已完成 '+finished+' / '+todayIds.size),meter);
  } else progress.replaceChildren();
  const todayRows=entries.map(({t,label,time})=>{
    const row=button('',()=>showTask(t),'overview-item'+(done.has(t.id)?' is-done':''));
    const body=node('span',null,'overview-item-body');
    const status=done.has(t.id)?'已完成':label==='交付'?'截止':label;
    body.append(node('strong',t.title),node('small',owner(t)+' · '+status));
    row.append(node('span',time || '待定','overview-time'),body,node('span','›','arrow'));
    return row;
  });
  $('overview-today').replaceChildren(...todayRows);
  if(!entries.length) $('overview-today').append(node('p','今天暂无安排。','empty'));

  const end=addDays(today,6);
  const assignments=tasks.filter(t=>t.type==='deadline' && t.date && !done.has(t.id));
  const upcoming=assignments.filter(t=>t.date>=today && t.date<=end);
  const earlier=assignments.filter(t=>t.date<today);
  $('overview-summary').textContent='今天有 '+(todayIds.size-finished)+' 项安排待处理，未来 7 天有 '+upcoming.length+' 份作业要交。';
  const due=$('overview-due');
  const expanded=due.querySelector('details')?.open;
  due.replaceChildren(...upcoming.map(taskRow));
  if(!upcoming.length) due.append(node('p','未来 7 天没有待交作业。','empty'));
  if(earlier.length) {
    const past=node('details');
    past.open=Boolean(expanded);
    past.append(node('summary','此前逾期 · '+earlier.length+' 份'),...earlier.reverse().map(taskRow));
    due.append(past);
  }
}
$('overview-plan').onclick=()=>moveBoard(todayKey());
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && !$('overview').hidden) renderOverview(list());
});
$('desk-new').onclick=()=>addOnDay(selectedDay);
function moveBoard(day) {boardStart=day;selectedDay=day;$('desk-message').textContent='';render();}
$('desk-prev').onclick=()=>moveBoard(addDays(boardStart,-1));
$('desk-next').onclick=()=>moveBoard(addDays(boardStart,1));
$('desk-today').onclick=()=>moveBoard(todayKey());
$('queue-scope').onchange=()=>renderWorkspace(list());
route();render();
