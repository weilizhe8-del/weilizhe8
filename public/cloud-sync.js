import { emptyDesk, mergeDesk, sameValue } from './desk-merge.js';

const endpoint = '/api/desk/v1';
const status = $('cloud-status');
let timer, busy = false, queued = false, conflict = null;
let lastCheck = 0;

function schedule(delay = 600) {
  clearTimeout(timer);
  timer = setTimeout(() => sync(), delay);
}

function localData() {
  // A second tab may have written while this one was waiting for a response.
  if (localStorage.getItem(storageKey) !== lastStored) throw Error('其他标签页已更新，刷新即可继续同步。');
  return validateBackupData({ ...emptyDesk, ...JSON.parse(lastStored) });
}

async function api(method, body) {
  const response = await fetch(endpoint, {
    method, credentials: 'same-origin', cache: 'no-store', redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  if (response.type === 'opaqueredirect' || [401, 403].includes(response.status)) {
    throw Error('登录已过期，请刷新页面重新登录。本机修改已保留。');
  }
  if (response.status === 409) return { conflict: true };
  if (response.status === 422 || response.status === 413) throw Error('云端未接收这份数据，请导出 JSON 备份。本机修改已保留。');
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) {
    throw Error('暂时连不上账号同步服务，本机修改已保留。');
  }
  return response.json();
}

function applySnapshot(data, checkpoint, recovery) {
  installPersonalData(data, recovery, checkpoint);
  $('undo-import').hidden = !recoverySnapshot;
  syncInfo();
  render();
}

async function sync(preference) {
  if (busy) { queued = true; return; }
  busy = true;
  try {
    const remote = await api('GET');
    if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 ||
        (remote.revision === 0) !== (remote.data === null)) throw Error('云端数据格式异常，已保留本机版本。');
    if (cloudCheckpoint && remote.revision < cloudCheckpoint.revision) throw Error('云端版本早于本机同步记录，已暂停上传。');
    const there = validateBackupData(remote.data ?? emptyDesk);
    const here = localData();
    const choice = conflict?.revision === remote.revision && sameValue(conflict.here, here) ? preference : undefined;
    const merged = mergeDesk(cloudCheckpoint?.data ?? emptyDesk, here, there, choice);
    if (merged.conflicts.length && !choice) {
      conflict = { revision: remote.revision, here };
      $('cloud-conflict').hidden = false;
      const names = merged.conflicts.slice(0, 3).map(key => {
        if (key === 'home') return '常用平台顺序';
        if (key.startsWith('task:')) return [...here.plans, ...there.plans].find(t => t.id === key.slice(5))?.title || '事项记录';
        return key.startsWith('site:') ? '收藏网站' : key.startsWith('project:') ? '项目笔记' : '示例状态';
      });
      status.textContent = '两台设备修改了同一项（' + names.join('、') + '），请选择保留的版本。其他修改会自动合并。';
      return;
    }
    $('cloud-conflict').hidden = true;
    conflict = null;
    const data = validateBackupData(merged.data);
    const checkpoint = { revision: remote.revision, data: there };
    const resolving = Boolean(choice && merged.conflicts.length);
    if (!sameValue(data, here) || resolving) {
      // Keep currently open editors and drag operations intact until the user finishes.
      if (document.querySelector('dialog[open]') || document.querySelector('[draggable="true"]:active')) {
        status.textContent = '云端有更新，结束当前操作后同步。';
        return;
      }
      const alternative = resolving
        ? validateBackupData(mergeDesk(cloudCheckpoint?.data ?? emptyDesk, here, there, choice === 'local' ? 'remote' : 'local').data)
        : recoverySnapshot;
      applySnapshot(data, checkpoint, alternative);
    } else if (remote.revision > 0 && cloudCheckpoint?.revision !== remote.revision) {
      writePersonalData(data, recoverySnapshot, checkpoint);
    }
    if (!sameValue(data, there)) {
      status.textContent = '正在保存到云端…';
      const saved = await api('PUT', { revision: remote.revision, data });
      if (saved.conflict) { queued = true; return; }
      if (saved.revision !== remote.revision + 1) throw Error('云端写入尚未确认，本机会重试。');
      // Local edits during PUT are still dirty relative to the acknowledged snapshot.
      const current = localData();
      writePersonalData(current, recoverySnapshot, { revision: saved.revision, data });
      if (!sameValue(current, data)) { queued = true; return; }
    }
    lastCheck = Date.now();
    status.textContent = '账号已同步 · ' + new Date(lastCheck).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    status.textContent = error instanceof TypeError || error.name === 'TimeoutError'
      ? '网络暂不可用，本机修改会在恢复连接后同步。'
      : error.message;
  } finally {
    busy = false;
    if (queued) { queued = false; schedule(100); }
  }
}

window.addEventListener('desk-saved', () => {
  status.textContent = '已保存到本机，等待同步…';
  schedule();
});
window.addEventListener('online', () => schedule(0));
window.addEventListener('pageshow', () => schedule(0));
document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });
document.addEventListener('close', () => schedule(0), true);
setInterval(() => { if (!document.hidden && Date.now() - lastCheck >= 25000) schedule(0); }, 30000);
$('cloud-retry').onclick = () => sync();
$('cloud-local').onclick = () => sync('local');
$('cloud-remote').onclick = () => sync('remote');
schedule(0);
