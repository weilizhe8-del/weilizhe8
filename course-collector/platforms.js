export function platformFor(address) {
  const url = new URL(address);
  if (url.hostname === 'hike-teaching-center.polymas.com' && url.pathname.replace(/\/$/, '') === '/stu-hike/studyTask') return 'polymas';
  if (url.hostname === 'mooc2-ans.chaoxing.com' && url.pathname.replace(/\/$/, '') === '/mooc2-ans/mycourse/stu') {
    return ({8: 'work', 9: 'exam'})[url.searchParams.get('pageHeader')];
  }
}

export function subscriptionAddress(address) {
  const url = new URL(address);
  const platform = platformFor(address);
  if (platform === 'polymas') return url.origin + url.pathname;
  if (platform && url.searchParams.get('courseid') && url.searchParams.get('clazzid')) {
    const fields = ['courseid', 'clazzid', 'pageHeader'];
    return url.origin + url.pathname + '?' + new URLSearchParams(fields.map(k => [k, url.searchParams.get(k)]));
  }
  return address;
}

// Runs in the page. Only return list metadata and inspect visible, authorized course frames.
export function readPlatform(platform, expectedUrl, frameUrls = []) {
  const subframe = window !== window.top;
  if (subframe ? !frameUrls.includes(location.href) : location.href !== expectedUrl) {
    return {error: '列表地址已变化，请检查登录并重新订阅。'};
  }
  const docs = [];
  const external = [];
  function collect(doc) {
    if (!doc?.body || docs.includes(doc)) return;
    docs.push(doc);
    for (const frame of doc.querySelectorAll('iframe[src]')) {
      if (!frame.getClientRects().length || !frame.clientHeight || !frame.clientWidth) continue;
      if (frame.contentDocument?.body) collect(frame.contentDocument);
      else if (platform !== 'polymas' && !subframe) {
        const url = new URL(frame.src, doc.baseURI);
        if (url.protocol === 'https:' && /(?:^|\.)chaoxing\.com$/.test(url.hostname)) external.push(url.href);
      }
    }
  }
  collect(document);
  if (docs.some(doc => [...doc.querySelectorAll('input[type=password]')].some(el => el.getClientRects().length))) {
    return {error: '请先在当前浏览器登录课程平台。'};
  }
  const status = /^(未交|未提交|待提交|未完成|未考|待考|未开始|进行中|已交|已提交|已完成|已考|已批阅|待批阅)$/;
  const finished = /^(已交|已提交|已完成|已考|已批阅|待批阅)$/;
  const badge = /^(?:作业|任务|考试|测验|测试)$/;
  const clock = /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?/g;
  function stamp(match) {
    if (!match) return null;
    const [, year, month, day, hour, minute] = match;
    const date = [year, month.padStart(2,'0'), day.padStart(2,'0')].join('-');
    const parsed = new Date(date + 'T00:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== date || +hour > 23 || +minute > 59) return null;
    return {date, time: hour ? hour.padStart(2,'0') + ':' + minute : ''};
  }
  // Text nodes preserve adjacent badge, title and status boundaries even in flex layouts.
  function tokens(el) {
    const doc = el.ownerDocument;
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = doc.createRange();
    const items = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const s = node.nodeValue.trim().replace(/\s+/g, ' ');
      if (!s || node.parentElement.closest('script,style,template,option,button,[hidden]')) continue;
      range.selectNodeContents(node);
      if (range.getClientRects().length && doc.defaultView.getComputedStyle(node.parentElement).visibility === 'visible') items.push({s, el:node.parentElement});
    }
    return items;
  }
  const rows = [];
  let count, incomplete = 0, countdown = false, empty = false;
  for (const doc of docs) {
    const contents = tokens(doc.body);
    const page = contents.map(x => x.s).join(' ');
    if (platform === 'polymas') {
      const total = page.match(/待完成\s*[（(]\s*(\d+)\s*[）)]/);
      if (!total || !page.includes('待办任务')) continue;
      count = Number(total[1]);
      for (const anchor of contents.filter(x => /^所属课程\s*[：:]/.test(x.s) || x.s === '所属课程')) {
        for (let el = anchor.el; el && el !== doc.body; el = el.parentElement) {
          const parts = tokens(el).map(x => x.s);
          const joined = parts.join(' ');
          const timing = joined.match(/(?:考试时间|作业时间|起止时间|截止(?:时间|日期)|结束时间)\s*[：:]?/);
          if (!timing || parts.filter(s => /^所属课程/.test(s)).length !== 1) continue;
          const start = parts.findIndex(s => /^(考试时间|作业时间|起止时间|截止时间|截止日期|结束时间)/.test(s));
          const prefix = parts.slice(0, start).filter(s => !/^\d+[.、]?$/.test(s) && !badge.test(s));
          const title = prefix.join(' ').trim();
          if (start < 1 || !title || title.length > 240) continue;
          const meta = joined.slice(timing.index + timing[0].length).split(/所属课程\s*[：:]?\s*/);
          const dates = [...meta[0].matchAll(clock)];
          if (dates.length < 1 || dates.length > 2) break;
          const end = stamp(dates.at(-1));
          if (!end || !meta[1]) break;
          rows.push({title,course:meta[1].trim().slice(0,100),type:/考试|测验|测试/.test(parts.slice(0,start).join(' ') + timing[0])?'quiz':'deadline',...end});
          break;
        }
      }
      continue;
    }
    if (/暂无(?:作业|考试|任务|测验)|没有(?:作业|考试|任务)/.test(page)) empty = true;
    for (const anchor of contents.filter(x => status.test(x.s))) {
      // Filter controls can carry the same words as a task status.
      if (anchor.el.closest('label, button, [role=radio]')) continue;
      let item;
      for (let el = anchor.el; el && el !== doc.body; el = el.parentElement) {
        const parts = tokens(el).map(x => x.s);
        if (parts.some(s => /^(全部|筛选)$/.test(s)) || parts.filter(s => status.test(s)).length > 1) break;
        const index = parts.indexOf(anchor.s);
        const title = parts.slice(0,index).filter(s => !badge.test(s)).join(' ').trim();
        if (!title || title.length > 240) continue;
        if (item && title !== item.title) break;
        item = {title, parts};
        if (finished.test(anchor.s) || /剩余|截止(?:时间|日期)?/.test(parts.join(' '))) break;
      }
      if (!item) continue;
      const row = {title:item.title, course:'', type:platform === 'exam'?'quiz':'deadline', date:null,time:''};
      if (finished.test(anchor.s)) row.completed = true;
      else {
        const meta = item.parts.slice(item.parts.indexOf(anchor.s)+1).join(' ');
        const explicit = meta.match(/截止(?:时间|日期)?\s*[：:]?\s*(\d{4}[-/.年].*)/);
        const exact = explicit && stamp([...explicit[1].matchAll(clock)][0]);
        const remaining = meta.match(/剩余\s*(?:(\d+)\s*天\s*)?(?:(\d+)\s*(?:小时|时)\s*)?(?:(\d+)\s*(?:分钟|分))?/);
        if (exact) Object.assign(row,exact);
        else if (remaining && remaining[3]) {
          const minutes = Number(remaining[1]||0)*1440 + Number(remaining[2]||0)*60 + Number(remaining[3]);
          if (minutes < 2*366*1440) {
            const until = new Date(Date.now()+minutes*60000+8*3600000).toISOString();
            Object.assign(row,{date:until.slice(0,10),time:until.slice(11,16),estimated:true});
            countdown = true;
          }
        }
        if (!row.date) incomplete++;
      }
      rows.push(row);
    }
  }
  if (platform === 'polymas' && count !== rows.length) return {error:'待办任务尚未完整显示，请切换到全部任务后重试。'};
  if (platform !== 'polymas' && !rows.length && !empty) return {error:'未读到作业或考试列表，请确认已打开相应栏目并等待加载。', external};
  return {rows, incomplete, countdown, ready:true};
}
