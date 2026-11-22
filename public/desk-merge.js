export const emptyDesk = { plans: [], done: [], notes: [], links: [], requirements: [], projectNotes: [], synced: false };

// Keep a task and its dependent notes, completion flag and links together, including on deletion.
function entries(data) {
  const records = new Map();
  const task = id => {
    const key = 'task:' + id;
    if (!records.has(key)) records.set(key, {});
    return records.get(key);
  };
  for (const plan of data.plans) task(plan.id).plan = plan;
  for (const id of data.done) task(id).done = true;
  for (const field of ['notes', 'links', 'requirements']) {
    for (const [id, value] of data[field]) task(id)[field] = value;
  }
  for (const [id, value] of Object.entries(data.timeChanges || {})) task(id).slot = value;
  for (const [id, note] of data.projectNotes) records.set('project:' + id, note);
  for (const site of data.bookmarks || []) records.set('site:' + site.url, site);
  if (data.homePlatforms) records.set('home', data.homePlatforms);
  if (data.synced) records.set('examples', true);
  return records;
}

export function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeDesk(base, local, remote, preference) {
  const original = entries(base), mine = entries(local), theirs = entries(remote);
  const result = structuredClone(emptyDesk);
  const conflicts = [];
  for (const key of new Set([...theirs.keys(), ...mine.keys(), ...original.keys()])) {
    const old = original.get(key), here = mine.get(key), there = theirs.get(key);
    let value = there;
    if (!sameValue(here, old) && !sameValue(here, there)) {
      if (!sameValue(there, old)) conflicts.push(key);
      if (sameValue(there, old) || preference === 'local') value = here;
    }
    if (value === undefined) continue;
    if (key.startsWith('task:')) {
      const id = key.slice(5);
      if (value.plan) result.plans.push(value.plan);
      if (value.done) result.done.push(id);
      for (const field of ['notes', 'links', 'requirements']) {
        if (value[field] !== undefined) result[field].push([id, value[field]]);
      }
      if (value.slot) (result.timeChanges ??= {})[id] = value.slot;
    } else if (key.startsWith('project:')) result.projectNotes.push([key.slice(8), value]);
    else if (key.startsWith('site:')) (result.bookmarks ??= []).push(value);
    else if (key === 'home') result.homePlatforms = value;
    else if (key === 'examples') result.synced = true;
  }
  return { data: result, conflicts };
}
