const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function loadModule(path) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, URL, Date, JSON, Error, Set };
  vm.runInNewContext(code, context); return context.exports;
}
const { taskGroups, escapeHtml } = loadModule('src/lib/tasks.ts');
const { createBackup, parseBackup, restoreBackup, rollbackBackup, SNAPSHOT_KEY } = loadModule('src/lib/backup.ts');
function store(seed = {}) {
  const values = new Map(Object.entries(seed));
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
}
const task = (id, deadline, completedAt) => ({ id, name: id, deadline, category: '作业', ...(completedAt ? { completedAt } : {}) });
test('today includes old overdue tasks, excludes completed, week stops at next Monday', () => {
  const groups = taskGroups([task('overdue', '2026-09-01T12:00:00'), task('today', '2026-09-19T23:59:00'), task('sunday', '2026-09-20T12:00:00'), task('next', '2026-09-21T00:00:00'), task('done', '2026-09-18T12:00:00', '2026-09-18T13:00:00')], new Date('2026-09-19T12:00:00'));
  assert.equal(groups.today.map(t => t.id).join(','), 'overdue,today');
  assert.equal(groups.week.map(t => t.id).join(','), 'sunday');
  assert.equal(groups.completed.length, 1);
});
test('Sunday and Monday boundaries use calendar week, not rolling seven days', () => {
  const events = [task('mon', '2026-09-21T00:00:00')];
  assert.equal(taskGroups(events, new Date('2026-09-20T23:59:59')).week.length, 0);
  assert.equal(taskGroups(events, new Date('2026-09-21T00:00:00')).today.length, 1);
});
test('export includes both semesters and completed tasks, excludes cookies and unrelated data', () => {
  const storage = store({ wd_courses: '[]', wd_courses_2026_autumn: '[]', wd_events: JSON.stringify([task('done', '2026-09-19', '2026-09-19')]), wd_video_cookie: 'secret', unrelated: 'private', wd_restore_snapshot: '{}' });
  const backup = createBackup(storage);
  assert.equal(Object.keys(backup.data).sort().join(','), 'wd_courses,wd_courses_2026_autumn,wd_events');
  assert.equal(parseBackup(JSON.stringify(backup)).data.wd_events, storage.getItem('wd_events'));
});
test('partial restore preserves unmentioned data and supports rollback including absent keys', () => {
  const storage = store({ wd_events: JSON.stringify([task('old', '2026-09-19')]), wd_courses: '[]', wd_video_cookie: 'secret' });
  const before = storage.getItem('wd_events');
  const backup = createBackup(store({ wd_events: '[]', wd_courses_2026_autumn: '[]' }));
  restoreBackup(storage, backup);
  assert.equal(storage.getItem('wd_events'), '[]'); assert.equal(storage.getItem('wd_video_cookie'), 'secret');
  rollbackBackup(storage);
  assert.equal(storage.getItem('wd_events'), before); assert.equal(storage.getItem('wd_courses_2026_autumn'), null); assert.equal(storage.getItem(SNAPSHOT_KEY), null);
});
test('invalid JSON, unsupported version, malformed records, script URLs and unsafe IDs rejected', () => {
  assert.throws(() => parseBackup('{'));
  for (const data of [{ wd_events: '{}' }, { wd_video_cookie: '"x"' }, { wd_events: JSON.stringify([task("bad'id", '2026-09-19')]) }, { wd_events: JSON.stringify([task('bad-date', 'not a date')]) }, { wd_quick_links: JSON.stringify([{ name: 'x', url: 'javascript:alert(1)' }]) }, { wd_courses_2026_autumn: JSON.stringify([{ id: 'x', name: 'x', credits: 3, components: 'bad' }]) }]) {
    assert.throws(() => parseBackup(JSON.stringify({ format: 'weilizhe8-backup', version: 1, exportedAt: new Date().toISOString(), data })));
  }
  const backup = createBackup(store({ wd_events: '[]' })); backup.version = 99;
  assert.throws(() => parseBackup(JSON.stringify(backup)));
});
test('quota failure does not partially overwrite data', () => {
  const storage = store({ wd_events: JSON.stringify([task('old', '2026-09-19')]), wd_courses_2026_autumn: '[]' });
  const before = storage.getItem('wd_events'); const setter = storage.setItem;
  let failed = false;
  storage.setItem = (key, value) => { if (key === 'wd_courses_2026_autumn' && !failed) { failed = true; throw new Error('quota'); } setter(key, value); };
  assert.throws(() => restoreBackup(storage, createBackup(store({ wd_events: '[]', wd_courses_2026_autumn: '[]' }))));
  assert.equal(storage.getItem('wd_events'), before); assert.equal(storage.getItem('wd_courses_2026_autumn'), '[]');
});
test('snapshot storage failure leaves user data untouched', () => {
  const storage = store({ wd_events: JSON.stringify([task('old', '2026-09-19')]) }); const before = storage.getItem('wd_events');
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => restoreBackup(storage, createBackup(store({ wd_events: '[]' })))); assert.equal(storage.getItem('wd_events'), before);
});
test('task content is escaped for HTML', () => assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
