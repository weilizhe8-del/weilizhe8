export const BACKUP_FORMAT = 'weilizhe8-backup';
export const SNAPSHOT_KEY = 'wd_restore_snapshot';
export type Backup = { format: string; version: number; exportedAt: string; data: Record<string, string> };
type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
export function isBackupKey(key: string) {
  return /^(wd_events|wd_quick_links|wd_tool_links|wd_wheel|wd_courses(?:_\d{4}_[a-z]+)?|wd_grades(?:_\d{4}_[a-z]+)?)$/.test(key);
}
export function createBackup(storage: Store): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)!;
    if (isBackupKey(key)) data[key] = storage.getItem(key)!;
  }
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date().toISOString(), data };
}
const record = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: any) => typeof v === 'string' && v.length <= 20000;
const id = (v: any) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const date = (v: any) => text(v) && Number.isFinite(Date.parse(v));
const number = (v: any) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function validateData(key: string, value: any): boolean {
  const optionalText = (v: any, k: string) => v[k] === undefined || text(v[k]);
  if (key === 'wd_events') return Array.isArray(value) && value.every(v => record(v) && id(v.id) && text(v.name) && date(v.deadline) && text(v.category) && ['location', 'importance', 'urgency'].every(k => optionalText(v, k)) && (v.completedAt === undefined || date(v.completedAt)));
  if (key.startsWith('wd_courses')) return Array.isArray(value) && value.every(v => record(v) && id(v.id) && text(v.name) && number(v.credits) && ['projectName', 'projectDeadline', 'finalExamDeadline', 'finalExamLocation'].every(k => optionalText(v, k)) && (v.components === undefined || Array.isArray(v.components) && v.components.every((c: any) => record(c) && text(c.name) && number(c.weight) && c.weight <= 100)));
  if (key.startsWith('wd_grades')) return record(value) && (value.mode === undefined || ['five', 'hundred'].includes(value.mode)) && (value.grades === undefined || record(value.grades) && Object.entries(value.grades).every(([k, v]) => id(k) && (text(v) || number(v))));
  if (key === 'wd_quick_links' || key === 'wd_tool_links') return Array.isArray(value) && value.every(v => {
    if (!record(v) || !text(v.name) || !text(v.url) || (key === 'wd_tool_links' && !id(v.id)) || !optionalText(v, 'category')) return false;
    try { return ['https:', 'http:'].includes(new URL(v.url).protocol); } catch { return false; }
  });
  if (key === 'wd_wheel') return record(value) && Array.isArray(value.options) && value.options.every(text) && Array.isArray(value.history) && value.history.every((v: any) => record(v) && text(v.result) && date(v.time));
  return false;
}
export function parseBackup(raw: string): Backup {
  if (raw.length > 5 * 1024 * 1024) throw new Error('备份超过 5 MB，请选择较小的文件。');
  let backup: any;
  try { backup = JSON.parse(raw); } catch { throw new Error('文件不是有效的 JSON 备份。'); }
  if (!record(backup) || backup.format !== BACKUP_FORMAT || backup.version !== 1 || !date(backup.exportedAt) || !record(backup.data) || !Object.keys(backup.data).length) throw new Error('不是本站支持的备份文件。');
  for (const [key, rawValue] of Object.entries(backup.data)) {
    if (!isBackupKey(key) || typeof rawValue !== 'string') throw new Error('备份含有不支持的数据类别。');
    let value;
    try { value = JSON.parse(rawValue); } catch { throw new Error('备份内容损坏，未恢复任何数据。'); }
    if (!validateData(key, value)) throw new Error('备份数据格式不完整或无效，未恢复任何数据。');
    if (Array.isArray(value) && value.some(v => v.id) && new Set(value.map(v => v.id)).size !== value.length) throw new Error('备份中有重复记录编号。');
  }
  return backup;
}
function writeTransaction(storage: Store, data: Record<string, string | null>) {
  const previous = Object.fromEntries(Object.keys(data).map(key => [key, storage.getItem(key)]));
  try {
    for (const [key, value] of Object.entries(data)) value === null ? storage.removeItem(key) : storage.setItem(key, value);
  } catch (error) {
    for (const [key, value] of Object.entries(previous)) value === null ? storage.removeItem(key) : storage.setItem(key, value);
    throw error;
  }
}
export function restoreBackup(storage: Store, input: Backup) {
  const backup = parseBackup(JSON.stringify(input));
  const snapshot = Object.fromEntries(Object.keys(backup.data).map(key => [key, storage.getItem(key)]));
  // Snapshot must succeed before changing any user data (including quota errors).
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  writeTransaction(storage, backup.data);
}
export function rollbackBackup(storage: Store) {
  const raw = storage.getItem(SNAPSHOT_KEY);
  if (!raw) throw new Error('没有可撤销的导入。');
  const snapshot = JSON.parse(raw);
  if (!record(snapshot) || Object.entries(snapshot).some(([k, v]) => !isBackupKey(k) || v !== null && typeof v !== 'string')) throw new Error('快照无效。');
  writeTransaction(storage, snapshot);
  storage.removeItem(SNAPSHOT_KEY);
}
