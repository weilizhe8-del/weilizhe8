import { DurableObject } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = 'https://cool-dawn-efca.cloudflareaccess.com';
const audience = 'c4af3955c15f1c94d06f44172cffb5dda7348af34683005366fc4a36e4139496';
const keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
const maxBytes = 1024 * 1024;

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

async function readUpdate(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const update = await new Response(new Blob(chunks)).json();
  const data = update?.data;
  if (!Number.isSafeInteger(update?.revision) || update.revision < 0 || typeof data?.synced !== 'boolean' ||
      !['plans', 'done', 'notes', 'links', 'requirements', 'projectNotes'].every(key => Array.isArray(data[key]))) return null;
  return update;
}

export class StudentDesk extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS desk (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)');
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
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/desk/v1') return env.ASSETS.fetch(request);
    if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'method' }, 405);
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
    if (request.method === 'GET') return json(await desk.snapshot());
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'origin' }, 403);
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({ error: 'json' }, 415);
    let update;
    try { update = await readUpdate(request); } catch { return json({ error: 'invalid' }, 400); }
    if (!update) return json({ error: 'invalid-or-too-large' }, 422);
    const result = await desk.save(update.revision, update.data);
    return json(result, result.conflict ? 409 : 200);
  }
};
