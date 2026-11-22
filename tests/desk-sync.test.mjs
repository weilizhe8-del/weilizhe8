import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDesk, mergeDesk } from '../public/desk-merge.js';

const task = (id, title = id) => ({ id, title, type: 'deadline', date: null, courses: [] });
const desk = (fields = {}) => ({ ...structuredClone(emptyDesk), ...fields });

test('first sync preserves existing homework even if the other device opened first', () => {
  const old = desk({ plans: [task('hw')], homePlatforms: ['https://example.com/'] });
  for (const [local, remote] of [[old, emptyDesk], [emptyDesk, old]]) {
    assert.deepEqual(mergeDesk(emptyDesk, local, remote), { data: old, conflicts: [] });
  }
});

test('independent offline changes to homework and platform order combine', () => {
  const base = desk({ plans: [task('one')], homePlatforms: ['https://a.test/', 'https://b.test/'] });
  const local = { ...base, plans: [...base.plans, task('two')] };
  const remote = { ...base, homePlatforms: [...base.homePlatforms].reverse() };
  assert.deepEqual(mergeDesk(base, local, remote), { data: { ...local, homePlatforms: remote.homePlatforms }, conflicts: [] });
});

test('task deletion propagates, and simultaneous edits can be recovered by choosing either version', () => {
  const base = desk({ plans: [task('one')], notes: [['one', 'old']] });
  assert.deepEqual(mergeDesk(base, emptyDesk, base), { data: emptyDesk, conflicts: [] });
  const remote = { ...base, notes: [['one', 'new']] };
  assert.deepEqual(mergeDesk(base, emptyDesk, remote, 'local'), { data: emptyDesk, conflicts: ['task:one'] });
  assert.deepEqual(mergeDesk(base, emptyDesk, remote, 'remote'), { data: remote, conflicts: ['task:one'] });
});

test('an explicitly empty home platform list stays empty', () => {
  const pinned = desk({ homePlatforms: ['https://example.com/'] });
  const unpinned = desk({ homePlatforms: [] });
  assert.deepEqual(mergeDesk(pinned, pinned, unpinned), { data: unpinned, conflicts: [] });
});
