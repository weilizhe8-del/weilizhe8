// This function is also injected by chrome.scripting into a registered list page.
export function readList(expectedUrl) {
  if (location.href !== expectedUrl) return { error: '页面地址已变更，请检查登录或重新选择列表。' };
  if (document.querySelector('input[type=password]')) return { error: '请先在平台完成登录。' };
  const text = el => (el?.innerText || el?.textContent || '').trim().replace(/\s+/g, ' ');
  const titleHeader = /^(?:作业|任务|测验|测试|考试|试卷|实验|项目)(?:名称|标题)?$|^(?:标题|名称|assignment(?: name)?|title)$/i;
  const deadlineHeader = /截止|最迟提交|结束时间|due(?: date| at)?/i;
  const rows = [];
  let recognized = false, incomplete = 0;
  function entry(title, deadline, course, typeHint) {
    if (!title || title.length > 240 || /^(?:操作|暂无.*|进入考试|开始答题)$/.test(title)) return;
    const datePattern = /(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})日?(?:[ T]+(\d{1,2}):(\d{2})(?::\d{2})?)?/g;
    const matches = [...deadline.matchAll(datePattern)];
    if (matches.length !== 1) { incomplete++; return; }
    const [, y, m, d, h, min] = matches[0], pad = s => s.padStart(2,'0');
    const date = y+'-'+pad(m)+'-'+pad(d);
    const parsed = new Date(date+'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== date || (h && (+h>23 || +min>59))) { incomplete++; return; }
    rows.push({title, course:course.slice(0,100), date, time:h?pad(h)+':'+min:'', type:/考试|测验|测试|quiz/i.test(typeHint+' '+title)?'quiz':'deadline'});
  }
  for (const table of document.querySelectorAll('table, [role=table]')) {
    if (!table.getClientRects().length) continue;
    const trs = [...table.querySelectorAll('tr, [role=row]')];
    const cells = r => [...r.querySelectorAll(':scope > th, :scope > td, :scope > [role=columnheader], :scope > [role=cell]')];
    const header = trs.find(r=>cells(r).some(c=>titleHeader.test(text(c))) && cells(r).some(c=>deadlineHeader.test(text(c))));
    if (!header) continue;
    const headers = cells(header).map(text);
    const titleIndex=headers.findIndex(h=>titleHeader.test(h)), dueIndex=headers.findIndex(h=>deadlineHeader.test(h));
    const courseIndex=headers.findIndex(h=>/^课程(?:名称)?$|^course$/i.test(h));
    recognized = true;
    for (const r of trs.slice(trs.indexOf(header)+1)) {
      if (!r.getClientRects().length) continue;
      const cs = cells(r);
      if (cs.length <= Math.max(titleIndex,dueIndex)) continue;
      entry(text(cs[titleIndex]),text(cs[dueIndex]),text(cs[courseIndex]),headers[titleIndex]);
    }
  }
  // Some course lists use cards with explicit deadline labels instead of table headers.
  if (!recognized) {
    for (const card of document.querySelectorAll('li, article, [class*="examItem"], [class*="homeworkItem"], [class*="work-item"]')) {
      if (card.querySelector('li, article') || !card.getClientRects().length) continue;
      const label = text(card).match(/(?:截止(?:提交)?(?:日期|时间)?|结束时间)\s*[：:]?\s*(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:[ T]+\d{1,2}:\d{2})?)/);
      const heading = card.querySelector('h2,h3,h4,[class*="title" i],[class*="name" i]');
      if (label && heading && text(heading) !== text(card)) {
        recognized = true; entry(text(heading),label[1],'','');
      }
    }
  }
  return recognized ? {rows, incomplete} : {error:'未识别作业列表。请打开有作业名称和截止时间的列表页。'};
}
