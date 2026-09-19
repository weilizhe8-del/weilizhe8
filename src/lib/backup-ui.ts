import { createBackup, parseBackup, restoreBackup, rollbackBackup, SNAPSHOT_KEY, type Backup } from './backup';
import { requestConfirmation } from './confirm';
export function setupBackup(refresh: () => void) {
  let pending: Backup | null = null;
  const get = (id: string) => document.getElementById(id)!;
  const status = (message: string) => { get('backup-status').textContent = message; };
  const sync = () => {
    const time = localStorage.getItem('wd_last_backup');
    get('last-backup').textContent = time ? `上次导出：${new Date(time).toLocaleString('zh-CN')}` : '尚未导出过备份';
    get('backup-rollback').classList.toggle('hidden', !localStorage.getItem(SNAPSHOT_KEY));
  };
  get('export-backup').addEventListener('click', () => {
    try {
      const backup = createBackup(localStorage);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `weilizhe8-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      localStorage.setItem('wd_last_backup', backup.exportedAt); sync(); status('已发起下载，请确认备份文件已保存在设备上。');
    } catch { status('导出失败，请检查浏览器是否允许下载及本地存储。'); }
  });
  get('backup-file').addEventListener('change', async event => {
    pending = null; get('backup-preview').classList.add('hidden');
    const input = event.target as HTMLInputElement; const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('备份超过 5 MB，请选择较小的文件。');
      pending = parseBackup(await file.text());
      let courses = 0, events = 0;
      for (const [key, raw] of Object.entries(pending.data)) { if (key.startsWith('wd_courses')) courses += JSON.parse(raw).length; if (key === 'wd_events') events = JSON.parse(raw).length; }
      get('backup-summary').textContent = `备份时间：${new Date(pending.exportedAt).toLocaleString('zh-CN')}。包含 ${Object.keys(pending.data).length} 类数据、${courses} 门课程、${events} 条日程（含已完成）。`;
      get('backup-preview').classList.remove('hidden'); status('文件检查通过，确认后才会更改当前数据。');
    } catch (error) { status((error as Error).message); }
    input.value = '';
  });
  get('cancel-import').addEventListener('click', () => { pending = null; get('backup-preview').classList.add('hidden'); status('已取消，当前数据未更改。'); });
  get('confirm-import').addEventListener('click', () => {
    if (!pending) return;
    try { restoreBackup(localStorage, pending); pending = null; get('backup-preview').classList.add('hidden'); refresh(); sync(); status('恢复完成。需要时可撤销上次导入。'); }
    catch { status('恢复失败，未完成导入。请检查浏览器存储空间；当前数据快照会保留。'); sync(); }
  });
  get('rollback-import').addEventListener('click', async () => {
    if (!await requestConfirmation('回到上次导入前的状态？导入后对这些数据所做的修改也会撤销。', '撤销导入')) return;
    try { rollbackBackup(localStorage); refresh(); sync(); status('已回到上次导入前的状态。'); } catch (error) { status((error as Error).message); }
  });
  sync();
}
