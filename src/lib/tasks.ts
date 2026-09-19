export type Task = { id: string; name: string; deadline: string; category: string; location?: string; importance?: string; urgency?: string; completedAt?: string };
export function isCompleted(task: Task) { return !!task.completedAt; }
export function taskGroups(tasks: Task[], now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
  const nextMonday = new Date(monday); nextMonday.setDate(monday.getDate() + 7);
  const active = tasks.filter(t => !isCompleted(t)).sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  return { active, today: active.filter(t => Date.parse(t.deadline) < +tomorrow), week: active.filter(t => Date.parse(t.deadline) >= +tomorrow && Date.parse(t.deadline) < +nextMonday), completed: tasks.filter(isCompleted), overdue: active.filter(t => Date.parse(t.deadline) < +now), monday, nextMonday };
}
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
