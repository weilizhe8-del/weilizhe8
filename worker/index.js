import { DurableObject } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { feedUrl, readCanvas, applyEvents, hour, FeedError } from './canvas.js';

const issuer = 'https://cool-dawn-efca.cloudflareaccess.com';
const audience = 'c4af3955c15f1c94d06f44172cffb5dda7348af34683005366fc4a36e4139496';
const keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
const maxBytes = 1024 * 1024;

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function readJson(request,limit) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new Response(new Blob(chunks)).json();
}

async function readUpdate(request) {
  const update = await readJson(request,maxBytes);
  const data = update?.data;
  if (!Number.isSafeInteger(update?.revision) || update.revision < 0 || typeof data?.synced !== 'boolean' ||
      !['plans', 'done', 'notes', 'links', 'requirements', 'projectNotes'].every(key => Array.isArray(data[key]))) return null;
  return update;
}

export class StudentDesk extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.store = ctx.storage;
    this.sql.exec('CREATE TABLE IF NOT EXISTS desk (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)');
    this.sql.exec("CREATE TABLE IF NOT EXISTS canvas (id INTEGER PRIMARY KEY, url TEXT, generation TEXT, checked INTEGER, total INTEGER, skipped INTEGER, message TEXT, previous TEXT)");
  }
  snapshot() {
    const [row] = this.sql.exec('SELECT revision, data FROM desk WHERE id = 1');
    return row ? { revision: row.revision, data: JSON.parse(row.data) } : { revision: 0, data: null };
  }
  save(revision, data) {
    // There is no await between the version check and the write in this per-account object.
    const current = this.snapshot();
    if (current.revision !== revision) return { conflict: true, revision: current.revision };
    this.sql.exec('INSERT OR REPLACE INTO desk (id, revision, data) VALUES (1, ?, ?)', revision + 1, JSON.stringify(data));
    return { revision: revision + 1 };
  }
  canvasStatus() {
    const [row]=this.sql.exec('SELECT checked,total,skipped,message FROM canvas WHERE id=1');
    return row ? {bound:true,...row} : {bound:false};
  }
  async canvasAction(action,input) {
    const [before]=this.sql.exec('SELECT * FROM canvas WHERE id=1');
    if(action==='disconnect'){
      this.sql.exec('DELETE FROM canvas WHERE id=1');
      return this.canvasStatus();
    }
    try {
      if(action==='refresh' && !before) throw new FeedError('请先绑定日历。');
      const url=action==='refresh'?before.url:feedUrl(input);
      const {items,skipped}=await readCanvas(url);
      if(action==='preview') return {total:items.length,skipped,sample:items.slice(0,5).map(({title,date,time})=>({title,date,time}))};
      await this.store.setAlarm(Date.now()+hour);
      return this.store.transactionSync(()=>{
        const [current]=this.sql.exec('SELECT generation FROM canvas WHERE id=1');
        if(current?.generation!==before?.generation) throw new FeedError('订阅已在其他设备更新，请刷新后再试。');
        const {revision,data}=this.snapshot();
        const merged=applyEvents(data,items,JSON.parse(before?.previous || '{}'));
        if(merged.changed){
          if(new TextEncoder().encode(JSON.stringify(merged.data)).length>maxBytes-128) throw new FeedError('导入后超过工作台容量，已保留原有安排。');
          this.save(revision,merged.data);
        }
        this.sql.exec('INSERT OR REPLACE INTO canvas VALUES (1,?,?,?,?,?,?,?)',url,crypto.randomUUID(),Date.now(),items.length,skipped,'',JSON.stringify(merged.signatures));
        return this.canvasStatus();
      });
    } catch(e) {
      const error=e instanceof FeedError?e.message:'同步服务暂不可用，请稍后再试。';
      if(action==='refresh' && before)this.sql.exec('UPDATE canvas SET message=? WHERE generation=?',error,before.generation);
      return {error};
    }
  }
  async alarm() {
    if(!this.canvasStatus().bound) return;
    await this.store.setAlarm(Date.now()+hour);
    await this.canvasAction('refresh');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canvas=url.pathname==='/api/desk/v1/canvas';
    if (!canvas && url.pathname !== '/api/desk/v1') return env.ASSETS.fetch(request);
    if (!['GET', canvas?'POST':'PUT'].includes(request.method)) return json({ error: 'method' }, 405);
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return json({ error: 'login' }, 401);
    let email;
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'email', 'sub'] });
      if (typeof payload.email !== 'string' || !payload.email.trim()) return json({ error: 'login' }, 403);
      email = payload.email.trim().toLowerCase();
    } catch {
      return json({ error: 'login' }, 403);
    }
    const desk = env.DESKS.getByName(email);
    if (request.method === 'GET') return json(canvas?await desk.canvasStatus():await desk.snapshot());
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin' }, 403);
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({ error: 'json' }, 415);
    if(canvas){
      let body;try{body=await readJson(request,4096);}catch{return json({error:'请求格式无效。'},400);}
      if(!['preview','bind','refresh','disconnect'].includes(body?.action))return json({error:'未知操作。'},400);
      const result=await desk.canvasAction(body.action,body.url);
      return json(result,result.error?422:200);
    }
    let update;
    try { update = await readUpdate(request); } catch { return json({ error: 'invalid' }, 400); }
    if (!update) return json({ error: 'invalid-or-too-large' }, 422);
    const result = await desk.save(update.revision, update.data);
    return json(result, result.conflict ? 409 : 200);
  }
};
