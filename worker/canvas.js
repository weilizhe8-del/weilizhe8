import ICAL from 'ical.js';
import { emptyDesk } from '../public/desk-merge.js';

const origin = 'https://canvas.tongji.edu.cn';
export const hour = 3600000;
export class FeedError extends Error {}

export function feedUrl(input) {
  try {
    const u = new URL(input.trim().replace(/^webcal:/i, 'https:'));
    if (u.origin === origin && !u.username && !u.password && !u.search && !u.hash &&
        /^\/feeds\/calendars\/[\w-]+\.ics$/.test(u.pathname)) return u.href;
  } catch {}
  throw new FeedError('请复制同济 Canvas「日历馈送」弹窗里的完整 .ics 地址。');
}

function sourceLink(value) {
  try {
    const u = new URL(value, origin);
    if (u.origin === origin && !u.username && !u.password && /^\/courses\/\d+\/(assignments|quizzes|calendar_events|discussion_topics)\/\d+\/?$/.test(u.pathname)) return origin + u.pathname;
    if (u.origin === origin && u.pathname === '/calendar' && /^\d+$/.test(u.searchParams.get('event_id') || '')) {
      const link = new URL('/calendar',origin);
      for (const key of ['event_id','include_contexts']) if (u.searchParams.has(key)) link.searchParams.set(key,u.searchParams.get(key));
      return link.href;
    }
  } catch {}
  return '';
}

const shanghai = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function localDate(component) {
  const prop = component.getFirstProperty('dtstart');
  const start = prop?.getFirstValue();
  if (!start) return null;
  if (start.isDate) return {date:start.toString(),time:''};
  const tz = prop.getParameter('tzid');
  if (start.zone.tzid === 'floating' && tz && tz !== 'Asia/Shanghai') return null;
  const stamp = start.zone.tzid === 'floating' ? start.toString().replace('T',' ') : shanghai.format(start.toJSDate());
  return {date:stamp.slice(0,10),time:stamp.slice(11,16)};
}

export async function parseFeed(text) {
  if (!/^BEGIN:VCALENDAR\s*$/im.test(text) || !/END:VCALENDAR\s*$/i.test(text.trim())) throw Error();
  const cal = new ICAL.Component(ICAL.parse(text.trim()));
  if (cal.name !== 'vcalendar') throw Error();
  const items = new Map();
  let skipped = 0;
  for (const event of cal.getAllSubcomponents('vevent')) {
    const get = key => event.getFirstPropertyValue(key);
    const uid = get('uid'), title = String(get('summary') || '').trim();
    if (get('status') === 'CANCELLED') continue;
    const when = localDate(event);
    if (!uid || !title || !when || event.hasProperty('rrule') || event.hasProperty('rdate')) { skipped++; continue; }
    const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([uid,String(get('recurrence-id') || '')])));
    const id = 'canvas-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    const link = sourceLink(get('url'));
    const type = /quiz|测验|小测|考试/i.test(uid+' '+link+' '+title) ? 'quiz' :
      /assignment|作业|实验报告/i.test(uid+' '+link+' '+title) ? 'deadline' : 'attendance';
    items.set(id,{id,title,type,...when,link});
  }
  return {items:[...items.values()],skipped};
}

export async function readCanvas(url) {
  try {
    const response = await fetch(feedUrl(url),{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'text/calendar'}});
    if (!response.ok || !response.body) throw Error();
    const reader=response.body.getReader(), decoder=new TextDecoder();
    let size=0, text='';
    for (;;) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.length;
      if(size>4*1024*1024){await reader.cancel();throw new FeedError('日历超过 4 MB，已暂停导入。');}
      text+=decoder.decode(value,{stream:true});
    }
    return await parseFeed(text+decoder.decode());
  } catch(e) {
    if(e instanceof FeedError) throw e;
    throw new FeedError('未能从校外读取有效日历。请核对馈送地址；如果 Canvas 要求校园网或重新登录，云端订阅暂时无法读取。');
  }
}

export function applyEvents(snapshot,items,previous) {
  const data=structuredClone(snapshot || emptyDesk);
  const plans=new Map(data.plans.map(p=>[p.id,p])),links=new Map(data.links);
  const signatures={};
  let changed=false;
  for(const item of items) {
    const {id,title,type,date,time,link}=item;
    signatures[id]=JSON.stringify(item);
    if(signatures[id]===previous[id]) continue;
    const old=plans.get(id);
    const next={...(old||{brief:'',courses:[],project:''}),id,title,type,date,time,source:'Canvas'};
    if (old?.endTime && (old.time!==time || old.type!==type)) delete next.endTime;
    plans.set(id,next);
    if(link && (!links.has(id) || links.get(id)===JSON.parse(previous[id] || '{}').link)) links.set(id,link);
    changed=true;
  }
  data.plans=[...plans.values()];data.links=[...links];
  return {data,signatures,changed};
}
