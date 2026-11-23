export const automaticLists = [
  {url:'https://mooc1-api.chaoxing.com/work/stu-work',name:'学习通 · 全部课程作业',kind:'work'},
  {url:'https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode',name:'学习通 · 全部课程考试',kind:'exam'},
  {url:'https://hike-teaching-center.polymas.com/stu-hike/studyTask',name:'AI 教学中心 · 待办任务',kind:'polymas'}
];

// Injected only into a freshly opened cross-course list. No assignment detail page is opened.
export function readSummary(kind, address) {
  if (location.origin + location.pathname !== address || document.querySelector('input[type=password]')) {
    return {error:'请在这个浏览器登录学习通，再检查平台。'};
  }
  const work = kind === 'work';
  const list = document.querySelector(work ? 'ul.nav' : 'ul.ks_list');
  const table = !work && document.querySelector('table.dataTable');
  const emptyText = work ? /^(?:暂无作业|没有作业|暂无相关作业)$/ : /^(?:暂无考试|没有考试|暂无相关考试|暂无考试记录|还没有考试)$/;
  const noData = document.body.innerText.split(/\n/).some(line=>emptyText.test(line.trim()));
  if (!list && !table && !noData) return {error:'学习通汇总页尚未显示列表，请检查登录状态。'};
  const tableRows = table ? [...table.querySelectorAll('tr.dataTr')] : [];
  const cards = tableRows.length ? tableRows : list ? [...list.querySelectorAll(':scope > li')] : [];
  const rows = [];
  let incomplete = 0, skipped = 0, unreadable = 0;
  const content = el => el?.textContent?.trim() || '';
  for (const card of cards) {
    if (card.hidden || card.style?.display === 'none') continue;
    const cells = tableRows.length ? card.querySelectorAll('td') : null;
    const root = cells ? card : card.querySelector(work ? '[role="option"]' : 'dl');
    const title = cells ? content(cells[1]) : content(root?.querySelector(work ? 'p' : 'dt')) ||
      (!work && content(card.querySelector('h3,h4,[class*="examName"],[class*="exam-name"],.ks_name')));
    if (!title || (cells && cells.length < 6)) {
      const label=content(card);
      if(label && !emptyText.test(label) && !/^(输入|添加|请输入)考试码/.test(label)) unreadable++;
      continue;
    }
    const spans = work ? [...root.querySelectorAll('span')].filter(el=>!el.closest('.fr')) : [];
    const status = cells ? content(cells[4])+' '+content(cells[5]) : content(work ? spans[0] : card.querySelector('.ks_state'));
    const course = work ? content(spans[1]) : '';
    const meta = cells ? content(cells[2]) : content(work ? root.querySelector('.fr') : root?.querySelector('dd') || card.querySelector('.ks_time'));
    const completed = /已完成|已交|已提交|已批阅|待批阅/.test(status);
    if (!completed && (/已截止|已结束|已过期/.test(status+' '+meta) || card.querySelector('img[src*="ks_02"]'))) { skipped++; continue; }
    let taskId='',courseId='',classId='';
    try {
      const params=new URL(card.getAttribute('data')||'',address).searchParams;
      taskId=params.get('taskrefId')||'';courseId=params.get('courseId')||'';
      classId=params.get('clazzId')||params.get('classId')||'';
    } catch { /* A plain list without a link can use course and title for identity. */ }
    const row = {title,course,courseId,classId,taskId,type:work?'deadline':'quiz',date:null,time:'',completed};
    if (!completed) {
      const dates=[...meta.matchAll(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T]+(\d{1,2}):(\d{2}))?/g)];
      const end=dates.at(-1);
      if(end && (dates.length>1 || !/开始|开放/.test(meta) || /截止|结束/.test(meta))) {
        const date=end[1]+'-'+end[2].padStart(2,'0')+'-'+end[3].padStart(2,'0');
        const parsed=new Date(date+'T00:00:00Z');
        if(Number.isFinite(+parsed) && parsed.toISOString().startsWith(date+'T') && !(+end[4]>23 || +end[5]>59)){
          row.date=date;row.time=end[4]?end[4].padStart(2,'0')+':'+end[5]:'';
        }
      } else if(!/距.*开始|开放|时长/.test(meta) && (work || /剩余|截止|结束|还剩/.test(meta))) {
        const units=[...meta.matchAll(/(\d+)\s*(天|小时|分钟|分|秒)/g)];
        const seconds=units.reduce((sum,m)=>sum+(+m[1])*({天:86400,小时:3600,分钟:60,分:60,秒:1})[m[2]],0);
        if(units.length && seconds<2*366*86400){
          const stamp=new Date(Date.now()+seconds*1000+8*3600000).toISOString();
          row.date=stamp.slice(0,10);row.time=stamp.slice(11,16);row.estimated=true;
        }
      }
      if (!row.date) incomplete++;
    }
    rows.push(row);
  }
  if (!rows.length && !skipped && (unreadable || !noData)) {
    return {error:unreadable?'汇总页有 '+unreadable+' 行尚未识别，已保留上次导入。':'学习通尚未确认列表为空，稍后将自动重试。'};
  }
  return {rows,ready:true,incomplete,skipped,unreadable};
}
