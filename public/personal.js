'use strict';

// Write the complete document first so a quota failure cannot partly apply a change.
function installPersonalData(data, snapshot = recoverySnapshot) {
  writePersonalData(data,snapshot);
  recoverySnapshot = snapshot;
  done.clear();
  for (const id of data.done) done.add(id);
  for (const [map,entries] of [
    [notes,data.notes], [taskLinks,data.links], [requirementLinks,data.requirements], [projectNotes,data.projectNotes]
  ]) {
    map.clear();
    for (const [id,value] of entries) map.set(id,value);
  }
  if (data.plans !== personalPlans) {
    personalPlans.length=0;
    for (const item of data.plans) personalPlans.push(item);
  }
  bookmarks=data.bookmarks || [];
  homePlatforms=data.homePlatforms ?? null;
  synced=data.synced;
  timeChanges=data.timeChanges || {};
}

const entryForm=$('entry-form');
let editingEntry=null;
for (const [value,label] of Object.entries(kind)) $('entry-type').add(new Option(label,value));
$('entry-course').add(new Option('未指定',''));
for (const [n,c] of courseByNumber) $('entry-course').add(new Option(c.name,n));
$('entry-project').add(new Option('未指定',''));
for (const p of projectCatalog) $('entry-project').add(new Option(p.name,p.id));

function updateDateInputs() {
  const undated=$('entry-undated').checked;
  $('entry-date').disabled=undated;
  $('entry-date').required=!undated;
  $('entry-time').disabled=undated;
}
function openEntryForm(item=null) {
  editingEntry=item;
  entryForm.reset();
  for (const input of entryForm.querySelectorAll('input')) input.setCustomValidity('');
  $('entry-heading').textContent=item?'编辑安排':'新建安排';
  $('entry-title').value=item?.title || '';
  $('entry-type').value=item?.type || 'deadline';
  $('entry-source').value=item?.source || '';
  $('entry-date').value=item?.date || selectedDay;
  $('entry-time').value=item?.time || '';
  $('entry-undated').checked=Boolean(item && !item.date);
  updateDateInputs();
  const filter=$('calendar-filter').value;
  $('entry-project').value=item ? item.project || '' : filter.startsWith('p:') ? filter.slice(2) : '';
  // Existing shared projects can have several courses; leave these inherited on edit.
  $('entry-course').value=item ? (item.courses?.length===1 ? item.courses[0] : '') : filter.startsWith('c:') ? filter.slice(2) : '';
  $('entry-brief').value=item?.brief || '';
  $('entry-requirement').value=item ? requirementLinks.get(item.id) || '' : '';
  $('entry-link').value=item ? taskLinks.get(item.id) || '' : '';
  $('entry-extra').open=Boolean($('entry-brief').value || $('entry-requirement').value || $('entry-link').value);
  $('entry-status').textContent='';
  $('entry-dialog').showModal();
  $('entry-title').focus();
}
$('new-task').onclick=()=>openEntryForm();
$('edit-personal').onclick=()=>selected.studyFor ? openSession(selected,true) : openEntryForm(selected);
$('entry-undated').onchange=updateDateInputs;
entryForm.oninput=e=>e.target.setCustomValidity?.('');
entryForm.onsubmit=e=>{
  e.preventDefault();
  const title=$('entry-title').value.trim();
  if (!title) {
    $('entry-title').setCustomValidity('请输入安排标题'); $('entry-title').reportValidity(); return;
  }
  const id=editingEntry?.id || 'plan-'+(crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2));
  const project=$('entry-project').value;
  const course=$('entry-course').value;
  const undated=$('entry-undated').checked;
  const item={id,title,type:$('entry-type').value,date:undated?null:$('entry-date').value,
    time:undated?'':$('entry-time').value,source:$('entry-source').value.trim(),brief:$('entry-brief').value.trim(),
    project,courses:course?[Number(course)]:(projectsById.get(project)?.courses || [])};
  const data=personalData();
  if (editingEntry?.endTime && item.time && ['plan','attendance'].includes(item.type)) {
    const duration=timeMinutes(editingEntry.endTime)-timeMinutes(editingEntry.time);
    const end=Math.min(1439,timeMinutes(item.time)+duration);
    if (end>timeMinutes(item.time)) item.endTime=clockTime(end);
  }
  for (const [field,key] of [['entry-link','links'],['entry-requirement','requirements']]) {
    const raw=$(field).value.trim();
    const url=httpUrl(raw);
    if (raw && !url) {
      $('entry-extra').open=true; $(field).setCustomValidity('请输入 http 或 https 链接'); $(field).reportValidity(); return;
    }
    data[key]=data[key].filter(([keyId])=>keyId!==id);
    if (url) data[key].push([id,url]);
  }
  data.plans=editingEntry ? personalPlans.map(t=>t.id===id?item:t) : [...personalPlans,item];
  try { installPersonalData(data); }
  catch { $('entry-status').textContent='未能写入本机存储，请保留表单并重试。'; return; }
  if (item.date) selectedDay=item.date;
  if (!matchesFilter(item,$('calendar-filter').value)) $('calendar-filter').value='';
  $('entry-dialog').close();
  if (editingEntry && $('detail').open) showTask(item);
  render();
};
entryForm.addEventListener('invalid',e=>{
  if ($('entry-extra').contains(e.target)) $('entry-extra').open=true;
},true);
$('delete-plan').onclick=()=>{
  const id=selected.id;
  if (!personalPlans.includes(selected) || !confirm('删除安排「'+selected.title+'」及关联笔记和链接？')) return;
  const data=personalData();
  data.plans=personalPlans.filter(t=>t.id!==id);
  data.done=data.done.filter(other=>other!==id);
  for (const key of ['notes','links','requirements']) data[key]=data[key].filter(([other])=>other!==id);
  try { installPersonalData(data); }
  catch { $('save-status').textContent='删除未保存，请重试。'; return; }
  $('detail').close(); render();
};
